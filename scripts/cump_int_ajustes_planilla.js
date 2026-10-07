/*
 * Gestión de Cumplimiento Interno — ajustes según la planilla de Remedy
 * 1) Revocar sesión: "Indicar Usuarios" → 'Indique Usuarios (separados por ";")' (como la planilla, + traducción es)
 *    y se quita su texto de ayuda (queda dicho en la etiqueta).
 * 2) Policies "Mostrar - …": borrar valor al ocultar; nombres sin espacio final y con tilde; orden 100…500 y Solo lectura al final.
 * 3) Orden de variables de 100 en 100 como la planilla (hoy hay 500 y 600 repetidos).
 * NO se cambian los values de "Tipo de requerimiento" (el Flow los compara).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = 'fc23e1321bd336d0d4f1a756624bcbc5';
var P = 'u_gest_cump_int_';
var REVOCAR_TXT = 'Indique Usuarios (separados por ";")';
var ORDEN = ['seleccione_tipo_requerimiento', 'indique_ciclo', 'indique_cantidad_usuarios', 'aplicacion_plataforma_kpe',
    'entorno', 'indique_usuarios', 'indicar_usrs', 'control_corresponde_solicitud', 'detalles_requerimiento'];
var POL = [   // [empieza con, nombre nuevo, orden]
    ['Mostrar - Controles compensatorios', 'Mostrar - Controles compensatorios', 100],
    ['Mostrar - Control de vigencia en BD', 'Mostrar - Control de vigencia en BD', 200],
    ['Mostrar - Revocar', 'Mostrar - Revocar sesión de usuarios', 300],
    ['Mostrar - Otros controles', 'Mostrar - Otros controles', 400],
    ['Solo lectura', 'Solo lectura', 900]
];

gs.print('DRY_RUN = ' + DRY_RUN);
function varRec(n) { var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', P + n); v.query(); return v.next() ? v : null; }

// 1) Revocar sesión
gs.print('\n1) Indicar Usuarios (Revocar sesión)');
var r = varRec('indicar_usrs');
if (!r) gs.print('❌ No existe ' + P + 'indicar_usrs');
else {
    gs.print('   texto "' + r.getValue('question_text') + '" → "' + REVOCAR_TXT + '" | ayuda "' + (r.getValue('help_text') || '').replace(/\n/g, '\\n') + '" → (sin ayuda)');
    if (!DRY_RUN) { r.setValue('question_text', REVOCAR_TXT); r.setValue('help_text', ''); r.setValue('show_help', false); if (r.isValidField('show_help_on_load')) r.setValue('show_help_on_load', false); r.update(); }
    ['question_text', 'help_text'].forEach(function (f) {
        var t = new GlideRecord('sys_translated_text');
        t.addQuery('tablename', 'item_option_new'); t.addQuery('documentkey', r.getUniqueValue()); t.addQuery('fieldname', f); t.addQuery('language', 'es'); t.query();
        if (!t.next()) return;
        var nuevo = f == 'question_text' ? REVOCAR_TXT : '';
        gs.print('   traducción es ' + f + ': "' + t.getValue('value') + '" → "' + nuevo + '"');
        if (!DRY_RUN) { if (nuevo) { t.setValue('value', nuevo); t.update(); } else t.deleteRecord(); }
    });
}

// 2) Policies
gs.print('\n2) Policies');
var NOMBRE = {}, mv = new GlideRecord('item_option_new'); mv.addQuery('cat_item', ITEM_ID); mv.query();
while (mv.next()) NOMBRE['IO:' + mv.getUniqueValue()] = mv.getValue('name').replace(P, '');
var p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID); p.query();
while (p.next()) {
    var nom = p.getValue('short_description'), def = null;
    POL.forEach(function (d) { if (!def && nom.indexOf(d[0]) == 0) def = d; });
    if (!def) { gs.print('   ⚠️ "' + nom + '" no está en la lista, no se toca'); continue; }
    var cambios = [];
    if (nom != def[1]) { cambios.push('nombre "' + nom + '" → "' + def[1] + '"'); p.setValue('short_description', def[1]); }
    if (p.getValue('order') != String(def[2])) { cambios.push('orden ' + p.getValue('order') + ' → ' + def[2]); p.setValue('order', def[2]); }
    gs.print('   • ' + def[1] + (cambios.length ? ': ' + cambios.join(' | ') : ': sin cambio'));
    if (cambios.length && !DRY_RUN) p.update();
    if (def[1] == 'Solo lectura') continue;
    var a = new GlideRecord('catalog_ui_policy_action'); a.addQuery('ui_policy', p.getUniqueValue()); a.query();
    while (a.next()) {
        if (a.getValue('visible') != 'true' || a.getValue('value_action') == 'clearValue') continue;
        gs.print('     → ' + (NOMBRE[a.getValue('catalog_variable')] || a.getValue('catalog_variable')) + ' | BORRAR VALOR');
        if (!DRY_RUN) { a.setValue('value_action', 'clearValue'); a.update(); }
    }
}

// 3) Orden
gs.print('\n3) Orden');
ORDEN.forEach(function (n, i) {
    var ord = (i + 1) * 100, v = varRec(n);
    if (!v) { gs.print('❌ No existe ' + P + n); return; }
    if (v.getValue('order') == String(ord)) return;
    gs.print('   • ' + n + ': ' + v.getValue('order') + ' → ' + ord);
    if (!DRY_RUN) { v.setValue('order', ord); v.update(); }
});
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
