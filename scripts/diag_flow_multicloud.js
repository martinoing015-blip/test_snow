/*
 * Diagnóstico Flow — Solicitud Masiva Entorno Multicloud (Flujo I)
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada, no necesita update set)
 * Muestra cada paso del Flow y qué variables del ítem usa (por nombre o sys_id),
 * y al final las variables activas que el Flow NO usa (no salen en la SCTASK si
 * el paso de tarea tiene lista explícita de variables).
 */
var ITEM_ID = '31c840631be3325058f65425604bcb53';

var it = new GlideRecord('sc_cat_item'); it.get(ITEM_ID);
var flowId = it.getValue('flow_designer_flow');
gs.print('Flow: ' + it.getDisplayValue('flow_designer_flow') + ' (' + flowId + ')');

// variables del ítem (y de sus sets)
var VARS = {}, ACTIVAS = {};
function addVar(v) { VARS[v.getUniqueValue()] = v.getValue('name'); if (v.getValue('active') == '1') ACTIVAS[v.getValue('name')] = true; }
var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.query(); while (v.next()) addVar(v);
var s = new GlideRecord('io_set_item'); s.addQuery('sc_cat_item', ITEM_ID); s.query();
while (s.next()) { var sv = new GlideRecord('item_option_new'); sv.addQuery('variable_set', s.getValue('variable_set')); sv.query(); while (sv.next()) addVar(sv); }

// flow + snapshots publicados
var ids = [flowId], f = new GlideRecord('sys_hub_flow');
if (f.get(flowId)) {
    gs.print('Estado: ' + f.getDisplayValue('status') + ' | activo: ' + f.getValue('active'));
    ['latest_snapshot', 'master_snapshot'].forEach(function (fld) {
        if (f.isValidField(fld) && f.getValue(fld) && ids.indexOf(f.getValue(fld)) == -1) ids.push(f.getValue(fld));
    });
}

var USADAS = {};
function leer(gr) {
    try { return GlideCompressionUtil.expandToString(GlideStringUtil.base64DecodeAsBytes(gr.getValue('values'))); }
    catch (e) { return gr.getValue('values') || ''; }
}
ids.forEach(function (id) {
    gs.print('\n=== ' + (id == flowId ? 'FLOW' : 'SNAPSHOT') + ' ' + id);
    ['sys_hub_action_instance_v2', 'sys_hub_flow_logic_instance_v2', 'sys_hub_sub_flow_instance_v2'].forEach(function (t) {
        var a = new GlideRecord(t);
        if (!a.isValid()) return;
        a.addQuery('flow', id); a.orderBy('order'); a.query();
        while (a.next()) {
            var txt = leer(a), usa = [];
            for (var sid in VARS) if (txt.indexOf(sid) > -1 || txt.indexOf(VARS[sid]) > -1) { usa.push(VARS[sid]); USADAS[VARS[sid]] = true; }
            var tipo = a.isValidField('action_type') ? a.getDisplayValue('action_type') :
                       a.isValidField('logic_definition') ? a.getDisplayValue('logic_definition') : t;
            gs.print('[' + a.getValue('order') + '] ' + tipo + (a.getValue('comment') ? ' — ' + a.getValue('comment') : ''));
            if (usa.length) gs.print('     variables: ' + usa.join(', '));
            if (/catalog_task|Catalog Task|Tarea de catálogo/i.test(tipo + txt)) gs.print('     (paso de tarea de catálogo)');
        }
    });
});

gs.print('\n--- VARIABLES ACTIVAS QUE EL FLOW NO MENCIONA');
var nada = true;
for (var n in ACTIVAS) if (!USADAS[n]) { gs.print('• ' + n); nada = false; }
if (nada) gs.print('(ninguna)');
gs.print('\nFIN (solo lectura)');
