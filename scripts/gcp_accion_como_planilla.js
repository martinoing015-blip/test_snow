/*
 * Google Cloud Platform — Acción requerida como la planilla: "Otorgar/Modificar Acceso" y "Eliminar Acceso"
 * Sin tocar values (el Flow los compara):
 *   otorgar_modificar_acceso: "Creación"     → "Otorgar/Modificar Acceso"
 *   eliminar_acceso:          "Eliminación"  → "Eliminar Acceso"
 *   modificacion:             "Modificación" → se INACTIVA (no se borra; los RITM antiguos la siguen mostrando)
 * El Flow no cambia: la rama "Otorgar o Modificar Acceso" ya entra con Creación (value otorgar_modificar_acceso)
 * y la de Eliminar compara eliminar_acceso. Las policies que aceptan "modificacion" quedan sin efecto, no molestan.
 * Traducción: si el texto nuevo tiene una traducción global distinta en sys_translated (ej. "Eliminar"),
 * se le agrega ​ al final para que el portal muestre el texto tal cual.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '0cd9733b1bfb3a5058f65425604bcb61';
var VAR = 'u_gcp_accion_requerida';
var TEXTOS = { otorgar_modificar_acceso: 'Otorgar/Modificar Acceso', eliminar_acceso: 'Eliminar Acceso' };
var INACTIVAR = ['modificacion'];
var ZW = '​';

gs.print('DRY_RUN = ' + DRY_RUN);
function traduccion(txt) {
    var t = new GlideRecord('sys_translated');
    t.addQuery('name', 'question_choice'); t.addQuery('element', 'text'); t.addQuery('value', txt); t.addQuery('language', 'es'); t.query();
    return t.next() ? t.getValue('label') : '';
}
var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', VAR); v.query();
if (!v.next()) gs.print('❌ No existe ' + VAR);
else {
    var c = new GlideRecord('question_choice'); c.addQuery('question', v.getUniqueValue()); c.orderBy('order'); c.query();
    while (c.next()) {
        var val = c.getValue('value'), txt = c.getValue('text');
        if (TEXTOS[val]) {
            var nuevo = TEXTOS[val], tr = traduccion(nuevo);
            if (tr && tr != nuevo) { gs.print('   (traducción global "' + nuevo + '" → "' + tr + '": se agrega \\u200B)'); nuevo += ZW; }
            if (txt == nuevo) { gs.print('• ' + val + ': sin cambio'); continue; }
            gs.print('• ' + val + ': "' + txt + '" → "' + nuevo.replace(ZW, '\\u200B') + '"');
            if (!DRY_RUN) { c.setValue('text', nuevo); c.update(); }
        } else if (INACTIVAR.indexOf(val) > -1) {
            if (c.getValue('inactive') == '1') { gs.print('• ' + val + ' ("' + txt + '"): ya inactiva'); continue; }
            var cnt = new GlideAggregate('sc_item_option_mtom');
            cnt.addQuery('sc_item_option.item_option_new', v.getUniqueValue()); cnt.addQuery('sc_item_option.value', val); cnt.addAggregate('COUNT'); cnt.query();
            gs.print('• ' + val + ' ("' + txt + '") → inactivar | RITM con esta opción: ' + (cnt.next() ? cnt.getAggregate('COUNT') : 0));
            if (!DRY_RUN) { c.setValue('inactive', true); c.update(); }
        } else gs.print('• ' + val + ' ("' + txt + '"): no se toca');
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
