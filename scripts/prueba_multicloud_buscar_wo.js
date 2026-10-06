/*
 * PRUEBA Solicitud Masiva Entorno Multicloud — 3) Buscar WO de los tickets de prueba
 * Para cada RITM "PRUEBA SMMC": muestra los campos u_ del RITM con valor (lo que llenó el Flow,
 * ej. "Llenar Wo Types") y busca registros en CUALQUIER tabla con un campo de referencia
 * a ese RITM (sc_req_item / task / sc_request).
 *
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada)
 */
var ITEM_ID = '31c840631be3325058f65425604bcb53';
var P = 'u_sol_mas_ent_mcld_';
var IGNORAR = { sysapproval_approver: 1, sysapproval_group: 1, sc_item_option_mtom: 1, sys_flow_context: 1,
    task_sla: 1, sys_email: 1, sys_journal_field: 1, sys_audit: 1, sys_attachment: 1, sc_req_item: 1, sc_request: 1 };

// tablas + campos que referencian RITM / task / request
var REFS = [];
var d = new GlideRecord('sys_dictionary');
d.addQuery('internal_type', 'reference'); d.addQuery('reference', 'IN', 'sc_req_item,task,sc_request'); d.query();
while (d.next()) {
    var tb = d.getValue('name'), el = d.getValue('element');
    if (!tb || !el || IGNORAR[tb] || tb.indexOf('sys_') == 0 || tb.indexOf('v_') == 0) continue;
    REFS.push({ t: tb, f: el, ref: d.getValue('reference') });
}
gs.print('Campos de referencia revisados: ' + REFS.length);

var dv = new GlideRecord('item_option_new');
dv.addQuery('cat_item', ITEM_ID); dv.addQuery('name', P + 'desc_solicitud'); dv.query(); dv.next();
var vistos = {};
var m = new GlideRecord('sc_item_option_mtom');
m.addQuery('sc_item_option.item_option_new', dv.getUniqueValue());
m.addQuery('sc_item_option.value', 'STARTSWITH', 'PRUEBA SMMC');
m.orderBy('request_item.number'); m.query();
while (m.next()) {
    var id = m.getValue('request_item'); if (vistos[id]) continue; vistos[id] = true;
    var r = new GlideRecord('sc_req_item'); if (!r.get(id)) continue;
    var desc = r.variables[P + 'desc_solicitud'] + '';
    gs.print('\n=== ' + r.getValue('number') + ' | ' + desc.split(' - ')[0] + ' | estado: ' + r.getDisplayValue('state') +
        ' | etapa: ' + r.getDisplayValue('stage') + ' | grupo: ' + r.getDisplayValue('assignment_group'));

    // campos u_ del RITM con valor
    var us = [], els = r.getElements();
    for (var i = 0; i < els.size(); i++) {
        var e = els.get(i), n = e.getName();
        if (n.indexOf('u_') == 0 && e.toString()) us.push(n + '=' + e.getDisplayValue());
    }
    gs.print('   Campos u_ del RITM: ' + (us.length ? us.join(' | ') : '(ninguno con valor)'));

    // registros que apuntan al RITM o a su REQ
    var ids = { sc_req_item: id, task: id, sc_request: r.getValue('request') }, hall = 0;
    REFS.forEach(function (x) {
        var g = new GlideRecord(x.t); if (!g.isValid()) return;
        g.addQuery(x.f, ids[x.ref]); g.setLimit(5); g.query();
        while (g.next()) {
            hall++;
            var num = g.isValidField('number') ? g.getValue('number') : g.getUniqueValue();
            var est = g.isValidField('state') ? ' | ' + g.getDisplayValue('state') : '';
            var grp = g.isValidField('assignment_group') ? ' | ' + g.getDisplayValue('assignment_group') : '';
            var sd = g.isValidField('short_description') ? ' | ' + g.getValue('short_description') : '';
            gs.print('   → ' + x.t + '.' + x.f + ': ' + num + est + grp + sd);
        }
    });
    if (!hall) gs.print('   (ningún registro apunta a este RITM / REQ)');
}
gs.print('\nFIN (solo lectura)');
