/*
 * ¿Qué catálogos tienen el grupo "Automatizaciones UASC"? — SOLO LECTURA
 * 1) Grupos cuyo nombre contiene "Automatizaciones UASC" o "XSOAR UASC".
 * 2) Catálogos (activos e inactivos) que tienen ese grupo en la pestaña "Process Engine Task"
 *    (Grupo de cumplimiento + Grupo tarea 1..5) o en cualquier otro campo de referencia a sys_user_group del ítem.
 * 3) Flows que nombran el grupo (por sys_id), y los catálogos que usan esos Flows.
 * 4) Estado de los catálogos de la fila de la planilla (grupos que tienen hoy).
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada)
 */
var GRUPOS_BUSCAR = ['Automatizaciones UASC', 'XSOAR UASC'];
var PLANILLA = ['Acceso Virtual Desktop VDI', 'Aprovisionamiento de Acceso Usuarios Externos GCP', 'Extensión de Vigencia de Cuentas de Dominio',
    'Gestión VPN para Colaborador Interno', 'Protocolo de conexión desde el Extranjero', 'Activar Cuentas Temporales',
    'Reset de Contraseña', 'Desvincular dispositivo de MFA', 'Cambio/Restablecimiento de contraseña'];

// 1) Grupos
gs.print('1) Grupos');
var GR = {};
GRUPOS_BUSCAR.forEach(function (n) {
    var g = new GlideRecord('sys_user_group'); g.addQuery('name', 'CONTAINS', n); g.query();
    if (!g.hasNext()) gs.print('   ❌ no hay grupos con "' + n + '"');
    while (g.next()) { GR[g.getUniqueValue()] = g.getValue('name'); gs.print('   • ' + g.getValue('name') + ' | ' + g.getUniqueValue() + ' | activo=' + g.getValue('active')); }
});
var ids = Object.keys(GR);

// campos de sc_cat_item que apuntan a sys_user_group
var CAMPOS = [];
var d = new GlideRecord('sys_dictionary'); d.addQuery('name', 'IN', 'sc_cat_item,sc_cat_item_producer'); d.addQuery('internal_type', 'reference'); d.addQuery('reference', 'sys_user_group'); d.query();
while (d.next()) if (CAMPOS.indexOf(d.getValue('element')) == -1) CAMPOS.push(d.getValue('element'));
gs.print('\nCampos de grupo en el ítem: ' + CAMPOS.join(', '));

function gruposDe(it) {
    var r = [];
    CAMPOS.forEach(function (c) { if (it.isValidField(c) && it.getValue(c)) r.push(it[c].getLabel() + ' (' + c + ') = ' + it.getDisplayValue(c)); });
    return r;
}

// 2) Catálogos con el grupo
gs.print('\n2) Catálogos con el grupo');
if (ids.length && CAMPOS.length) {
    var it = new GlideRecord('sc_cat_item');
    var qc = it.addQuery(CAMPOS[0], 'IN', ids.join(','));
    for (var i = 1; i < CAMPOS.length; i++) qc.addOrCondition(CAMPOS[i], 'IN', ids.join(','));
    it.orderBy('name'); it.query();
    gs.print('   Total: ' + it.getRowCount());
    while (it.next()) {
        var donde = [];
        CAMPOS.forEach(function (c) { if (it.isValidField(c) && GR[it.getValue(c)]) donde.push(it[c].getLabel() + ' (' + c + ')'); });
        gs.print('   • ' + it.getValue('name') + ' | ' + it.getUniqueValue() + ' | activo=' + it.getValue('active') + ' | en: ' + donde.join(', ') + ' | Flow: ' + it.getDisplayValue('flow_designer_flow'));
    }
}

// 3) Flows que nombran el grupo
gs.print('\n3) Flows que usan el grupo (por sys_id)');
var FLOWS = {};
['sys_hub_action_instance_v2', 'sys_hub_flow_logic_instance_v2'].forEach(function (t) {
    var a = new GlideRecord(t); if (!a.isValid()) return;
    a.addNotNullQuery('values'); a.query();
    while (a.next()) {
        var raw = a.getValue('values') || '', txt = raw;
        if (raw.indexOf('H4sI') == 0) { try { txt = GlideCompressionUtil.expandToString(GlideStringUtil.base64DecodeAsBytes(raw)); } catch (e) { txt = raw; } }
        ids.forEach(function (gid) { if (txt.indexOf(gid) > -1) FLOWS[a.getValue('flow')] = (FLOWS[a.getValue('flow')] || []).concat(GR[gid]); });
    }
});
var nf = 0;
for (var fid in FLOWS) {
    var fl = new GlideRecord('sys_hub_flow'); if (!fl.get(fid)) continue;   // snapshots no son sys_hub_flow
    nf++;
    var cats = [], ci = new GlideRecord('sc_cat_item'); ci.addQuery('flow_designer_flow', fid); ci.query();
    while (ci.next()) cats.push(ci.getValue('name') + (ci.getValue('active') == '1' ? '' : ' (inactivo)'));
    gs.print('   • ' + fl.getValue('name') + ' (' + fl.getDisplayValue('status') + ') | grupo: ' + FLOWS[fid].filter(function (x, i, a) { return a.indexOf(x) == i; }).join(', ') +
        ' | catálogos: ' + (cats.join('; ') || '(ninguno)'));
}
if (!nf) gs.print('   (ninguno)');

// 4) Catálogos de la planilla
gs.print('\n4) Catálogos de la fila de la planilla');
PLANILLA.forEach(function (n) {
    var vistos = {}, lista = [];
    var c = new GlideRecord('sc_cat_item'); c.addQuery('name', 'CONTAINS', n); c.query();
    while (c.next()) lista.push(c.getUniqueValue());
    var t = new GlideRecord('sys_translated_text'); t.addQuery('tablename', 'sc_cat_item'); t.addQuery('fieldname', 'name'); t.addQuery('language', 'es'); t.addQuery('value', 'CONTAINS', n); t.query();
    while (t.next()) lista.push(t.getValue('documentkey'));
    if (!lista.length) { gs.print('   ❌ "' + n + '": no encontrado'); return; }
    lista.forEach(function (sid) {
        if (vistos[sid]) return; vistos[sid] = true;
        var x = new GlideRecord('sc_cat_item'); if (!x.get(sid)) return;
        var g = gruposDe(x);
        var tiene = CAMPOS.some(function (cc) { return x.isValidField(cc) && GR[x.getValue(cc)]; });
        gs.print('   ' + (tiene ? '✅' : '⚠️') + ' "' + n + '" → ' + x.getValue('name') + ' | ' + sid + ' | activo=' + x.getValue('active') + ' | ' + (g.join(' | ') || '(sin grupos)'));
    });
});
gs.print('\nFIN (solo lectura)');
