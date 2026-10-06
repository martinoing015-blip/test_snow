/*
 * PRUEBA Solicitud Masiva Entorno Multicloud — 2) Revisar tickets de prueba
 * Busca los RITM cuya descripción empieza con "PRUEBA SMMC" y muestra:
 * variables con valor, estado del Flow, aprobaciones (aprobador / estado) y tareas / WO creadas.
 *
 * Cuenta: ADMIN | APROBAR=false SOLO LECTURA | APROBAR=true MODIFICA DATOS (aprueba las
 * aprobaciones pendientes de estos RITM para que el Flow avance al siguiente nivel / WO).
 * Correr varias veces: aprobar → esperar 1 min → revisar.
 */
var APROBAR = false;
var ITEM_ID = '31c840631be3325058f65425604bcb53';
var P = 'u_sol_mas_ent_mcld_';

gs.print('APROBAR = ' + APROBAR);
var dv = new GlideRecord('item_option_new');
dv.addQuery('cat_item', ITEM_ID); dv.addQuery('name', P + 'desc_solicitud'); dv.query(); dv.next();

var vistos = {};
var m = new GlideRecord('sc_item_option_mtom');
m.addQuery('sc_item_option.item_option_new', dv.getUniqueValue());
m.addQuery('sc_item_option.value', 'STARTSWITH', 'PRUEBA SMMC');
m.orderBy('request_item.number'); m.query();
var total = 0;
while (m.next()) {
    var id = m.getValue('request_item'); if (vistos[id]) continue; vistos[id] = true; total++;
    var r = new GlideRecord('sc_req_item'); if (!r.get(id)) continue;
    gs.print('\n=== ' + r.getValue('number') + ' | estado: ' + r.getDisplayValue('state') + ' | aprobación: ' + r.getDisplayValue('approval') +
        ' | previsto: ' + r.getDisplayValue('requested_for'));

    // variables con valor
    var vs = [];
    for (var k in r.variables) { var val = r.variables[k].getDisplayValue(); if (val) vs.push(k.replace(P, '') + '=' + val); }
    gs.print('   ' + vs.join(' | '));

    // Flow
    var fc = new GlideRecord('sys_flow_context'); fc.addQuery('source_record', id); fc.orderByDesc('sys_created_on'); fc.query();
    while (fc.next()) gs.print('   Flow: ' + fc.getValue('name') + ' | ' + fc.getDisplayValue('state'));

    // Aprobaciones
    var ap = new GlideRecord('sysapproval_approver'); ap.addQuery('sysapproval', id); ap.orderBy('sys_created_on'); ap.query();
    var n = 0;
    while (ap.next()) {
        n++;
        gs.print('   Aprobación ' + n + ': ' + ap.getDisplayValue('approver') + ' | ' + ap.getDisplayValue('state'));
        if (APROBAR && ap.getValue('state') == 'requested') {
            ap.setValue('state', 'approved'); ap.setValue('comments', 'Aprobado por script de prueba SMMC'); ap.update();
            gs.print('     → aprobada');
        }
    }
    if (!n) gs.print('   ⚠️ sin aprobaciones');

    // Tareas / WO hijas
    var t = new GlideRecord('task'); t.addQuery('parent', id); t.query();
    var nt = 0;
    while (t.next()) { nt++; gs.print('   Tarea: ' + t.getValue('number') + ' (' + t.getValue('sys_class_name') + ') | ' + t.getDisplayValue('state') + ' | ' + t.getDisplayValue('assignment_group') + ' | ' + t.getValue('short_description')); }
    var st = new GlideRecord('sc_task'); st.addQuery('request_item', id); st.addQuery('parent', '!=', id); st.query();
    while (st.next()) { nt++; gs.print('   SCTASK: ' + st.getValue('number') + ' | ' + st.getDisplayValue('state') + ' | ' + st.getDisplayValue('assignment_group')); }
    if (!nt) gs.print('   (sin tareas / WO todavía)');
}
gs.print('\nRITM de prueba: ' + total);
gs.print('FIN' + (APROBAR ? ' (aprobaciones pendientes aprobadas)' : ' (solo lectura)'));
