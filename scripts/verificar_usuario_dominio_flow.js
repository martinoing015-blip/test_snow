/*
 * ¿Algo usa "Usuario Dominio" de T1 / T2 esperando un usuario (referencia)? — SOLO LECTURA
 * Desde el 07-10 u_gest_cta_altpriv_t1/_t2_usuario_dominio es TEXTO (username), ya no Referencia (sys_id).
 * Revisa:
 *   1) Flow del ítem (y snapshots): pasos que mencionan la variable (por nombre o sys_id) y si tocan requested_for.
 *   2) Business rules, Script Includes, script actions y notificaciones que nombren la variable.
 *   3) Últimos RITM: previsto (requested_for) vs valor de Usuario Dominio (¿quedó vacío o distinto?).
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada)
 */
var ITEMS = { 'T1': '4adb81813bddc7902815757e53e45a22', 'T2': 'c65920cf1b933ed058f65425604bcb62' };
var ULTIMOS = 5;

function leer(gr) {
    var raw = gr.getValue('values') || '';
    if (raw.indexOf('H4sI') != 0) return raw;
    try { return GlideCompressionUtil.expandToString(GlideStringUtil.base64DecodeAsBytes(raw)); } catch (e) { return raw; }
}
for (var etq in ITEMS) {
    var ITEM_ID = ITEMS[etq];
    var it = new GlideRecord('sc_cat_item'); if (!it.get(ITEM_ID)) { gs.print('❌ ' + etq + ': no existe ' + ITEM_ID); continue; }
    var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', 'ENDSWITH', '_usuario_dominio'); v.query();
    if (!v.next()) { gs.print('❌ ' + etq + ': no encontré la variable usuario_dominio'); continue; }
    var VN = v.getValue('name'), VID = v.getUniqueValue();
    gs.print('\n==================== ' + etq + ' | ' + it.getValue('name'));
    gs.print('Variable: ' + VN + ' | tipo ' + v.getDisplayValue('type') + ' (' + v.getValue('type') + ')');

    // 1) Flow
    var flowId = it.getValue('flow_designer_flow');
    gs.print('\n1) Flow: ' + it.getDisplayValue('flow_designer_flow'));
    var ids = [flowId], f = new GlideRecord('sys_hub_flow');
    if (f.get(flowId)) ['latest_snapshot', 'master_snapshot'].forEach(function (x) { if (f.isValidField(x) && f.getValue(x) && ids.indexOf(f.getValue(x)) == -1) ids.push(f.getValue(x)); });
    var hay = false;
    ids.forEach(function (id) {
        ['sys_hub_action_instance_v2', 'sys_hub_flow_logic_instance_v2', 'sys_hub_sub_flow_instance_v2'].forEach(function (t) {
            var a = new GlideRecord(t); if (!a.isValid()) return;
            a.addQuery('flow', id); a.orderBy('order'); a.query();
            while (a.next()) {
                var txt = leer(a);
                if (txt.indexOf(VN) == -1 && txt.indexOf(VID) == -1) continue;
                hay = true;
                var tipo = a.isValidField('action_type') ? a.getDisplayValue('action_type') : a.isValidField('logic_definition') ? a.getDisplayValue('logic_definition') : t;
                gs.print('   ⚠️ [' + a.getValue('order') + '] ' + tipo + (a.getValue('comment') ? ' — ' + a.getValue('comment') : '') + (id == flowId ? '' : ' (snapshot)') +
                    (txt.indexOf('requested_for') > -1 ? '  ← toca requested_for (PREVISTO)' : ''));
            }
        });
    });
    if (!hay) gs.print('   ✅ ningún paso del Flow usa ' + VN);

    // 2) Scripts y notificaciones
    gs.print('\n2) Scripts y notificaciones que nombran ' + VN);
    var n2 = 0;
    [['sys_script', 'script', 'Business rule'], ['sys_script_include', 'script', 'Script Include'], ['sysevent_script_action', 'script', 'Script action'],
     ['sysevent_email_action', 'message_html', 'Notificación'], ['sys_script_client', 'script', 'Client script'], ['sysauto_script', 'script', 'Job']].forEach(function (d) {
        var g = new GlideRecord(d[0]); if (!g.isValid() || !g.isValidField(d[1])) return;
        g.addQuery(d[1], 'CONTAINS', VN); g.query();
        while (g.next()) { n2++; gs.print('   ⚠️ ' + d[2] + ': ' + (g.getValue('name') || g.getUniqueValue()) + ' [' + d[0] + ' ' + g.getUniqueValue() + ']'); }
    });
    if (!n2) gs.print('   ✅ ninguno');

    // 3) Últimos RITM
    gs.print('\n3) Últimos ' + ULTIMOS + ' RITM');
    var r = new GlideRecord('sc_req_item'); r.addQuery('cat_item', ITEM_ID); r.orderByDesc('sys_created_on'); r.setLimit(ULTIMOS); r.query();
    if (!r.hasNext()) gs.print('   (sin RITM)');
    while (r.next()) {
        var val = r.variables[VN] ? String(r.variables[VN]) : '';
        var rf = r.requested_for.user_name ? String(r.requested_for.user_name) : '(vacío)';
        var calza = val && rf != '(vacío)' && (rf == val || rf.split('@')[0] == val.split('@')[0]);
        gs.print('   • ' + r.getValue('number') + ' | ' + r.getValue('sys_created_on') + ' | previsto: ' + rf + ' | abierto por: ' + r.opened_by.user_name +
            ' | ' + VN.replace(/^u_gest_cta_altpriv_/, '') + ': "' + val + '"' + (val ? (calza ? '  ✅ calza' : '  ⚠️ no calza') : ''));
    }
}
gs.print('\nFIN (solo lectura)');
