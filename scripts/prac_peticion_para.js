/*
 * Practicantes — la variable u_prac_usuario_dominio_solicitante pasa a ser "Petición para":
 * etiqueta "Petición para" (base + traducciones) y, si DEFAULT_USUARIO_ACTUAL = true, viene con el usuario conectado,
 * así Nombres / Apellidos / Usuario de Dominio / RUT (oculto) se llenan solos al abrir el formulario.
 * No cambia el nombre interno de la variable (el Flow la usa) ni el Auto-populate.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = 'a6837d761b5736d0d4f1a756624bcb09';
var ETIQUETA = 'Petición para';
var DEFAULT_USUARIO_ACTUAL = true;

gs.print('DRY_RUN = ' + DRY_RUN);
var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', 'u_prac_usuario_dominio_solicitante'); v.query();
if (!v.next()) gs.print('❌ No existe u_prac_usuario_dominio_solicitante');
else {
    gs.print('Variable: "' + v.getValue('question_text') + '" | default: "' + (v.getValue('default_value') || '') + '"');
    var cambia = false;
    if (v.getValue('question_text') != ETIQUETA) { gs.print('• etiqueta → "' + ETIQUETA + '"'); v.setValue('question_text', ETIQUETA); cambia = true; }
    if (DEFAULT_USUARIO_ACTUAL && v.getValue('default_value') != 'javascript:gs.getUserID()') { gs.print('• default → usuario conectado (javascript:gs.getUserID())'); v.setValue('default_value', 'javascript:gs.getUserID()'); cambia = true; }
    if (!cambia) gs.print('= variable ya está');
    if (!DRY_RUN && cambia) v.update();
    var t = new GlideRecord('sys_translated_text'); t.addQuery('documentkey', v.getUniqueValue()); t.addQuery('fieldname', 'question_text'); t.query();
    while (t.next()) {
        gs.print('• traducción ' + t.getValue('tablename') + ' [' + t.getValue('language') + ']: "' + t.getValue('value') + '"' + (t.getValue('value') == ETIQUETA ? ' (ok)' : ' → "' + ETIQUETA + '"'));
        if (!DRY_RUN && t.getValue('value') != ETIQUETA) { t.setValue('value', ETIQUETA); t.update(); }
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
