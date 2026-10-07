/*
 * Google Cloud Platform — verificación contra la planilla y los cambios aplicados (07-10)
 * Muestra ✅ / ❌ por cada punto y al final lo que sigue distinto a la planilla (aprobado en la revisión).
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada)
 */
var ITEM_ID = '0cd9733b1bfb3a5058f65425604bcb61';
var P = 'u_gcp_';
var ZW = '\u200B';
var ok = 0, mal = 0;
function chk(cond, txt, det) { if (cond) ok++; else mal++; gs.print((cond ? '✅ ' : '❌ ') + txt + (det ? '  [' + det + ']' : '')); }
function varRec(n) { var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', P + n); v.query(); return v.next() ? v : null; }
function trEs(text) {
    var t = new GlideRecord('sys_translated'); t.addQuery('name', 'question_choice'); t.addQuery('element', 'text');
    t.addQuery('value', text); t.addQuery('language', 'es'); t.query(); return t.next() ? t.getValue('label') : '';
}
function verPortal(text) { var e = trEs(text); return (e || text).replace(ZW, ''); }   // lo que ve el usuario en español
function opciones(v) {
    var r = {}, c = new GlideRecord('question_choice'); c.addQuery('question', v.getUniqueValue()); c.orderBy('order'); c.query();
    while (c.next()) r[c.getValue('value')] = { text: c.getValue('text'), activa: c.getValue('inactive') != '1' };
    return r;
}
function policiesDe(v) {   // acciones de policies activas sobre la variable
    var res = [], p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID); p.addActiveQuery(); p.query();
    while (p.next()) {
        var a = new GlideRecord('catalog_ui_policy_action'); a.addQuery('ui_policy', p.getUniqueValue()); a.addQuery('catalog_variable', 'IO:' + v.getUniqueValue()); a.query();
        while (a.next()) res.push({ pol: p.getValue('short_description'), cond: p.getValue('catalog_conditions'), visible: a.getValue('visible'), oblig: a.getValue('mandatory') });
    }
    return res;
}

var it = new GlideRecord('sc_cat_item');
if (!it.get(ITEM_ID)) gs.print('❌ No existe el ítem');
else {
    gs.print('=== ' + it.getValue('name') + '\n');

    gs.print('--- Acción requerida');
    var acc = varRec('accion_requerida'), o = opciones(acc);
    chk(o.otorgar_modificar_acceso && o.otorgar_modificar_acceso.activa && verPortal(o.otorgar_modificar_acceso.text) == 'Otorgar/Modificar Acceso',
        'Opción 1 = "Otorgar/Modificar Acceso" (value otorgar_modificar_acceso)', o.otorgar_modificar_acceso ? 'portal: ' + verPortal(o.otorgar_modificar_acceso.text) : 'no existe');
    chk(o.eliminar_acceso && o.eliminar_acceso.activa && verPortal(o.eliminar_acceso.text) == 'Eliminar Acceso',
        'Opción 2 = "Eliminar Acceso" (value eliminar_acceso)', o.eliminar_acceso ? 'portal: ' + verPortal(o.eliminar_acceso.text) : 'no existe');
    chk(!o.modificacion || !o.modificacion.activa, '"Modificación" inactiva');
    var activas = []; for (var k in o) if (o[k].activa) activas.push(k);
    chk(activas.length == 2, 'Solo 2 opciones activas', activas.join(', '));

    gs.print('\n--- Indique cuenta T1 (siempre visible, no obligatoria)');
    var t1 = varRec('indique_cuenta_t1'), pt1 = policiesDe(t1);
    chk(t1 && t1.getValue('active') == '1' && t1.getValue('mandatory') != '1', 'Activa y no obligatoria en la variable');
    chk(!pt1.some(function (x) { return x.visible == 'true'; }), 'Ninguna policy la oculta', pt1.map(function (x) { return x.pol + ' visible=' + x.visible + ' oblig=' + x.oblig; }).join('; '));
    chk(pt1.some(function (x) { return x.oblig == 'true' && x.cond.indexOf('eliminar_acceso') > -1; }), 'Obligatoria solo en Eliminación con T1');
    ['GCP_LIMPIAR_ACCION', 'GCP_LIMPIAR_COLAB'].forEach(function (mk) {
        var cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.addQuery('script', 'CONTAINS', mk); cs.query();
        chk(cs.next() && (cs.getValue('script') || '').indexOf(P + 'indique_cuenta_t1') == -1, mk + ' no la borra');
    });
    var cp = new GlideRecord('catalog_script_client'); cp.addQuery('cat_item', ITEM_ID); cp.addQuery('script', 'CONTAINS', 'GCP_LIMPIAR_POSEE'); cp.query();
    chk(!cp.next() || cp.getValue('active') != '1', 'GCP_LIMPIAR_POSEE inactivo');

    gs.print('\n--- Otorgar/Modificar: Vigencia y tipo de rol');
    var vig = varRec('vigencia'), ov = opciones(vig);
    chk(ov.definida && verPortal(ov.definida.text) == 'Definida' && ov.indefinida && verPortal(ov.indefinida.text) == 'Indefinida',
        'Vigencia: Definida / Indefinida (no Temporal / Permanente)', ov.definida ? verPortal(ov.definida.text) + ' / ' + (ov.indefinida ? verPortal(ov.indefinida.text) : '?') : '');
    chk(policiesDe(vig).some(function (x) { return x.visible == 'true' && x.cond.indexOf('otorgar_modificar_acceso') > -1; }), 'Vigencia se muestra con Otorgar/Modificar');
    var cad = varRec('caducidad_vigencia');
    chk(cad && cad.getValue('type') == '9', 'Caducidad vigencia es Fecha', cad ? cad.getDisplayValue('type') : '');
    chk(policiesDe(cad).some(function (x) { return x.visible == 'true' && x.cond.indexOf('definida') > -1; }), 'Caducidad se muestra con Definida');
    var con = varRec('rol_consola_admin'), dom = varRec('rol_dominio_datos');
    chk(con && con.getValue('question_text') == 'Consola de administración', 'Casilla "Consola de administración"', con ? con.getValue('question_text') : '');
    chk(dom && dom.getValue('question_text') == 'Dominio de datos', 'Casilla "Dominio de datos"');
    var mat = varRec('nombre_matriz');
    chk(mat && mat.getValue('question_text') == 'Indique nombre de matriz GCP' && policiesDe(mat).some(function (x) { return x.visible == 'true' && x.cond.indexOf('rol_dominio_datos=true') > -1; }),
        'Dominio de datos → "Indique nombre de matriz GCP"');

    gs.print('\n--- Siempre');
    var des = varRec('descripcion_solicitud');
    chk(des && des.getValue('active') == '1' && des.getValue('type') == '2', 'Descripción de la solicitud (multilínea)', des ? des.getValue('question_text') : '');
    var set = new GlideRecord('io_set_item'); set.addQuery('sc_cat_item', ITEM_ID); set.addQuery('variable_set.title', 'CONTAINS', 'celulas'); set.query();
    chk(set.hasNext(), 'Pregunta de célula → Seleccione Célula (set de células)');

    gs.print('\n--- Descripción del ítem');
    var d = it.getValue('description') || '';
    chk(d.indexOf('plazo de hasta 5 d') > -1 && d.indexOf('Gestión de Cuenta con Alto Privilegio T1') > -1, 'Texto igual a la planilla (base)');

    gs.print('\n--- Flow');
    var flowId = it.getValue('flow_designer_flow'), txt = '';
    ['sys_hub_flow_logic_instance_v2', 'sys_hub_action_instance_v2'].forEach(function (t) {
        var a = new GlideRecord(t); if (!a.isValid()) return; a.addQuery('flow', flowId); a.query();
        while (a.next()) {
            var raw = a.getValue('values') || '';
            if (raw.indexOf('H4sI') == 0) { try { raw = GlideCompressionUtil.expandToString(GlideStringUtil.base64DecodeAsBytes(raw)); } catch (e) {} }
            txt += raw;
        }
    });
    chk(txt.indexOf('otorgar_modificar_acceso') > -1, 'El Flow compara otorgar_modificar_acceso (rama Otorgar o Modificar)');
    chk(txt.indexOf('eliminar_acceso') > -1, 'El Flow compara eliminar_acceso (rama Eliminar)');

    gs.print('\n--- Sigue distinto a la planilla (aprobado en la revisión, viene de Remedy)');
    [['colaborador_proveedor', '¿Colaborador interno o proveedor?'], ['posee_cuenta_t1', '¿Posee cuenta T1? (Eliminar)'], ['indique_rol_eliminar', 'Indique rol a eliminar (Eliminar)'],
     ['lbl_rol_admin', 'Etiqueta "¿Requiere rol administrativo?" (planilla: "Seleccione tipo de rol")'], ['es_proyecto', 'Proyecto'], ['requiere_rbac', '¿Se requiere este acceso según el modelo RBAC?']]
        .forEach(function (x) { var r = varRec(x[0]); if (r && r.getValue('active') == '1') gs.print('• ' + x[1] + (r.getValue('mandatory') == '1' ? ' (obligatoria)' : '')); });
    if (des && des.getValue('question_text') != 'Descripción de la solicitud') gs.print('• Etiqueta "' + des.getValue('question_text') + '" (planilla: "Descripción de la solicitud")');
    if (vig && con && parseInt(con.getValue('order'), 10) < parseInt(vig.getValue('order'), 10)) gs.print('• Orden: casillas de rol antes de Vigencia (planilla: Vigencia primero)');

    gs.print('\nResultado: ' + ok + ' OK, ' + mal + ' con problema');
}
gs.print('FIN (solo lectura)');
