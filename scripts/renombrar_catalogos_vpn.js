/*
 * Renombrar catálogos VPN (revisión: "Servicio reemplazado por nuevo servicio Gestión VPN …")
 *   "Habilitación de VPN para Colaborador Interno"    → "Gestión VPN para Colaborador Interno"
 *   "Habilitación de VPN para Filiales y Proveedores" → "Gestión VPN para Filiales y Proveedores"
 * 1) Ítems por sys_id (por nombre se encontraba "Navegación Privilegiada" d0bdf1ef…, que tiene mal el nombre base).
 * 2) Busca el nombre actual como TEXTO en BR, Script Includes, notificaciones, SLA, reglas de asignación,
 *    reportes, client scripts, UI actions, propiedades, jobs, REST, transform y Flows.
 *    (Flow, policies, client scripts del ítem y Llenar Wo Types apuntan por sys_id: no se rompen.)
 * 3) Si un ítem NO tiene usos por texto → (DRY_RUN=false) cambia name, short_description (si era igual al nombre)
 *    y sus traducciones es. Si tiene usos → NO lo renombra y los lista (FORZAR=true para renombrar igual).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var FORZAR = false;
var CAMBIOS = [   // [sys_id, nombre actual, nombre nuevo]
    ['eeb095361b1336d0d4f1a756624bcb21', 'Habilitación de VPN para Colaborador Interno', 'Gestión VPN para Colaborador Interno'],
    ['e37a279e1bd7f6d058f65425604bcbd6', 'Habilitación de VPN para Filiales y Proveedores', 'Gestión VPN para Filiales y Proveedores']
];

gs.print('DRY_RUN = ' + DRY_RUN + ' | FORZAR = ' + FORZAR);
function trRec(id, field) {
    var t = new GlideRecord('sys_translated_text');
    t.addQuery('tablename', 'sc_cat_item'); t.addQuery('documentkey', id); t.addQuery('fieldname', field); t.addQuery('language', 'es'); t.query();
    return t.next() ? t : null;
}
// 1) Ítems y nombres a buscar
var ITEMS = [];
CAMBIOS.forEach(function (c) {
    var it = new GlideRecord('sc_cat_item');
    if (!it.get(c[0])) { gs.print('❌ No existe el ítem ' + c[0]); return; }
    if (it.getValue('name') != c[1]) gs.print('⚠️ ' + c[0] + ' se llama "' + it.getValue('name') + '" (esperaba "' + c[1] + '"): revisar que sea el correcto');
    c = [c[1], c[2]];
    var tn = trRec(it.getUniqueValue(), 'name'), nombres = [it.getValue('name')];
    if (tn && nombres.indexOf(tn.getValue('value')) == -1) nombres.push(tn.getValue('value'));
    if (nombres.indexOf(c[0]) == -1) nombres.push(c[0]);
    ITEMS.push({ it: it, viejo: c[0], nuevo: c[1], nombres: nombres, usos: [] });
    gs.print('• ' + it.getUniqueValue() + ' | base "' + it.getValue('name') + '" | es ' + (tn ? '"' + tn.getValue('value') + '"' : '(sin traducción)') +
        ' | activo=' + it.getValue('active') + ' | Flow: ' + it.getDisplayValue('flow_designer_flow'));
});

// 2) Usos por texto
var DONDE = [
    ['sys_script', ['script', 'condition', 'filter_condition'], 'Business rule'],
    ['sys_script_include', ['script'], 'Script Include'],
    ['sysevent_email_action', ['condition', 'advanced_condition', 'message_html', 'subject'], 'Notificación'],
    ['sysevent_script_action', ['script'], 'Script action'],
    ['contract_sla', ['start_condition', 'stop_condition', 'pause_condition', 'cancel_condition'], 'SLA'],
    ['sysrule_assignment', ['condition', 'script'], 'Regla de asignación'],
    ['sys_report', ['filter'], 'Reporte'],
    ['catalog_script_client', ['script'], 'Catalog client script'],
    ['sys_script_client', ['script'], 'Client script'],
    ['sys_ui_action', ['script', 'condition'], 'UI action'],
    ['sys_properties', ['value'], 'Propiedad'],
    ['sysauto_script', ['script'], 'Job programado'],
    ['sys_ws_operation', ['operation_script'], 'REST API'],
    ['sys_transform_script', ['script'], 'Transform script']
];
ITEMS.forEach(function (x) {
    x.nombres.forEach(function (nom) {
        DONDE.forEach(function (d) {
            var g = new GlideRecord(d[0]); if (!g.isValid()) return;
            var qc = null;
            d[1].forEach(function (f) { if (!g.isValidField(f)) return; if (!qc) qc = g.addQuery(f, 'CONTAINS', nom); else qc.addOrCondition(f, 'CONTAINS', nom); });
            if (!qc) return;
            g.query();
            while (g.next()) {
                var nm = g.isValidField('name') ? g.getValue('name') : (g.isValidField('title') ? g.getValue('title') : g.getUniqueValue());
                x.usos.push(d[2] + ': ' + nm + (g.isValidField('active') && g.getValue('active') != '1' ? ' (inactivo)' : '') + ' [' + d[0] + ' ' + g.getUniqueValue() + ']');
            }
        });
    });
});
// Flows: una sola pasada para todos los nombres
['sys_hub_action_instance_v2', 'sys_hub_flow_logic_instance_v2', 'sys_hub_trigger_instance_v2'].forEach(function (t) {
    var a = new GlideRecord(t); if (!a.isValid()) return;
    a.addNotNullQuery('values'); a.query();
    while (a.next()) {
        var raw = a.getValue('values') || '', txt = raw;
        if (raw.indexOf('H4sI') == 0) { try { txt = GlideCompressionUtil.expandToString(GlideStringUtil.base64DecodeAsBytes(raw)); } catch (e) { txt = raw; } }
        ITEMS.forEach(function (x) {
            if (x.nombres.some(function (nom) { return txt.indexOf(nom) > -1; })) x.usos.push('Flow: ' + a.getDisplayValue('flow') + ' [' + t + ' ' + a.getUniqueValue() + ']');
        });
    }
});

// 3) Renombrar
ITEMS.forEach(function (x) {
    gs.print('\n=== "' + x.viejo + '" → "' + x.nuevo + '"');
    if (x.usos.length) { gs.print('⚠️ ' + x.usos.length + ' uso(s) del nombre como texto:'); x.usos.forEach(function (u) { gs.print('   • ' + u); }); }
    else gs.print('✅ Sin usos del nombre como texto: se puede renombrar');
    if (x.usos.length && !FORZAR) { gs.print('   → NO se renombra (revisar los usos; FORZAR=true para renombrar igual)'); return; }
    var it = x.it, sd = it.getValue('short_description');
    gs.print('   name: "' + it.getValue('name') + '" → "' + x.nuevo + '"');
    if (sd && x.nombres.indexOf(sd) > -1) gs.print('   short_description: "' + sd + '" → "' + x.nuevo + '"');
    var tn = trRec(it.getUniqueValue(), 'name'), ts = trRec(it.getUniqueValue(), 'short_description');
    if (tn) gs.print('   traducción es name: "' + tn.getValue('value') + '" → "' + x.nuevo + '"');
    if (ts && x.nombres.indexOf(ts.getValue('value')) > -1) gs.print('   traducción es short_description: "' + ts.getValue('value') + '" → "' + x.nuevo + '"');
    if (DRY_RUN) return;
    it.setValue('name', x.nuevo);
    if (sd && x.nombres.indexOf(sd) > -1) it.setValue('short_description', x.nuevo);
    it.update();
    if (tn) { tn.setValue('value', x.nuevo); tn.update(); }
    if (ts && x.nombres.indexOf(ts.getValue('value')) > -1) { ts.setValue('value', x.nuevo); ts.update(); }
    gs.print('   ✅ renombrado');
});
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
