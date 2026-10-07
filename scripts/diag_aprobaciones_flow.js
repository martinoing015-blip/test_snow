/*
 * ¿A quién apuntan las aprobaciones del Flow de un catálogo? — SOLO LECTURA
 * Para cada paso "Solicitar aprobación" (y las condiciones "Si" que lo rodean) muestra el contenido descomprimido
 * y resume lo que encuentra: cadena de jefaturas (manager, manager.manager…), campos u_ de sys_user, grupos y usuarios fijos.
 * Además lista los campos de sys_user relacionados con división / gerencia / departamento.
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada)
 */
var ITEM_ID = '1e4794ae1bd772d0d4f1a756624bcb74';   // Permisos de Conexión RDP
var MAX = 2500;                                     // caracteres de cada paso a imprimir

function leer(gr) {
    var raw = gr.getValue('values') || '';
    if (raw.indexOf('H4sI') != 0) return raw;
    try { return GlideCompressionUtil.expandToString(GlideStringUtil.base64DecodeAsBytes(raw)); } catch (e) { return raw; }
}
function nombrePor(tabla, id) { var g = new GlideRecord(tabla); return g.get(id) ? (g.getValue('name') || g.getDisplayValue()) : ''; }

var it = new GlideRecord('sc_cat_item');
if (!it.get(ITEM_ID)) gs.print('❌ No existe el ítem');
else {
    gs.print('=== ' + it.getValue('name') + ' | Flow: ' + it.getDisplayValue('flow_designer_flow'));
    gs.print('Grupos del ítem: cumplimiento=' + it.getDisplayValue('group') + ' | tarea1=' + it.getDisplayValue('u_grupo_tarea_1') + ' | tarea2=' + it.getDisplayValue('u_grupo_tarea_2') +
        ' | tarea3=' + it.getDisplayValue('u_grupo_tarea_3') + ' | aprobador=' + it.getDisplayValue('u_usuario_aprobador') + ' | aprobador1=' + it.getDisplayValue('u_usuario_aprobador1') +
        ' | aprobador2=' + it.getDisplayValue('u_usuario_aprobador2'));
    var flowId = it.getValue('flow_designer_flow');
    ['sys_hub_action_instance_v2', 'sys_hub_flow_logic_instance_v2'].forEach(function (t) {
        var a = new GlideRecord(t); if (!a.isValid()) return;
        a.addQuery('flow', flowId); a.orderBy('order'); a.query();
        while (a.next()) {
            var tipo = a.isValidField('action_type') ? a.getDisplayValue('action_type') : a.getDisplayValue('logic_definition');
            var txt = leer(a);
            var esAprob = /aprobaci|approval/i.test(tipo);
            var esSi = /^(Si|If)$/i.test(tipo);
            if (!esAprob && !(esSi && /manager|approv|aprob/i.test(txt))) continue;
            gs.print('\n----- [' + a.getValue('order') + '] ' + tipo + (a.getValue('comment') ? ' — ' + a.getValue('comment') : ''));
            // resumen
            var jef = txt.match(/(requested_for|opened_by|u_[a-z_]+)?(\.manager)+/g) || [];
            var uf = (txt.match(/\bu_[a-z0-9_]+/g) || []).filter(function (x, i, arr) { return arr.indexOf(x) == i; });
            var ids = (txt.match(/[0-9a-f]{32}/g) || []).filter(function (x, i, arr) { return arr.indexOf(x) == i; });
            if (jef.length) gs.print('   jefaturas: ' + jef.filter(function (x, i, arr) { return arr.indexOf(x) == i; }).join(', '));
            if (uf.length) gs.print('   campos u_: ' + uf.join(', '));
            ids.forEach(function (id) {
                var g = nombrePor('sys_user_group', id); if (g) { gs.print('   grupo fijo: ' + g + ' (' + id + ')'); return; }
                var u = nombrePor('sys_user', id); if (u) gs.print('   usuario fijo: ' + u + ' (' + id + ')');
            });
            gs.print('   contenido: ' + txt.substring(0, MAX) + (txt.length > MAX ? ' …(cortado)' : ''));
        }
    });
}

gs.print('\n=== Campos de sys_user relacionados con división / gerencia / departamento');
var d = new GlideRecord('sys_dictionary'); d.addQuery('name', 'sys_user');
var q = d.addQuery('element', 'CONTAINS', 'divis'); q.addOrCondition('element', 'CONTAINS', 'gerenc'); q.addOrCondition('element', 'CONTAINS', 'gerente');
q.addOrCondition('element', 'CONTAINS', 'depart'); q.addOrCondition('column_label', 'CONTAINS', 'divis'); q.addOrCondition('column_label', 'CONTAINS', 'gerent');
d.query();
if (!d.hasNext()) gs.print('(ninguno)');
while (d.next()) gs.print('• ' + d.getValue('element') + ' | "' + d.getValue('column_label') + '" | tipo ' + d.getValue('internal_type') + (d.getValue('reference') ? ' → ' + d.getValue('reference') : ''));
gs.print('\nFIN (solo lectura)');
