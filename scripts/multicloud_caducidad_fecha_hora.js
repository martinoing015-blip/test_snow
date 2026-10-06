/*
 * Solicitud Masiva Entorno Multicloud — Caducidad Vigencia: Fecha → Fecha/hora (como Remedy)
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (update set seleccionado y "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '31c840631be3325058f65425604bcb53';
var VAR_NAME = 'u_sol_mas_ent_mcld_caducidad_vigencia';

var v = new GlideRecord('item_option_new');
v.addQuery('cat_item', ITEM_ID); v.addQuery('name', VAR_NAME); v.query();
gs.print('DRY_RUN = ' + DRY_RUN);
if (!v.next()) gs.print('❌ No existe ' + VAR_NAME);
else if (v.getValue('type') == '10') gs.print('• ' + VAR_NAME + ' ya es Fecha/hora');
else {
    gs.print('• ' + VAR_NAME + ' | ' + v.getDisplayValue('type') + ' (' + v.getValue('type') + ') → Fecha/hora (10)');
    if (!DRY_RUN) { v.setValue('type', 10); v.update(); }
}
gs.print('FIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
