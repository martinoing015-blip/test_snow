/*
 * Quitar "-- Ninguno --" de una variable (Cuadro de selección / Opción múltiple)
 * La variable sigue obligatoria y parte SIN opción marcada (default vacío).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = 'a79c4c131b58cb1058f65425604bcb0d';   // cambiar si es otro catálogo
var PREGUNTA = 'Tipo de Cuenta';                     // etiqueta de la variable

gs.print('DRY_RUN = ' + DRY_RUN);
var v = new GlideRecord('item_option_new');
v.addQuery('cat_item', ITEM_ID); v.addQuery('question_text', 'STARTSWITH', PREGUNTA); v.addActiveQuery(); v.query();
if (v.getRowCount() > 1) gs.print('⚠️ Hay ' + v.getRowCount() + ' variables activas que empiezan con "' + PREGUNTA + '": se cambian todas, revisar');
if (!v.hasNext()) gs.print('❌ No se encontró "' + PREGUNTA + '" en el ítem (¿viene de un variable set? esos no se tocan)');
while (v.next()) {
    gs.print('• ' + v.getValue('name') + ' | ' + v.getDisplayValue('type') + ' (' + v.getValue('type') + ') | obligatoria ' + v.getValue('mandatory'));
    var c = new GlideRecord('question_choice'); c.addQuery('question', v.getUniqueValue()); c.addQuery('inactive', false); c.orderBy('order'); c.query();
    var ops = []; while (c.next()) ops.push(c.getValue('value') + '="' + c.getValue('text') + '"');
    gs.print('   opciones: ' + ops.join(', '));
    gs.print('   include_none ' + v.getValue('include_none') + ' → false | default "' + (v.getValue('default_value') || '') + '" → ""');
    if (!DRY_RUN) { v.setValue('include_none', false); v.setValue('default_value', ''); v.update(); }
}
gs.print('FIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
