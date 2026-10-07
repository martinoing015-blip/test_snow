/*
 * Gestión de Cuenta con Alto Privilegio T0 — orden de variables como Remedy
 * Acción requerida → Vigencia → Caducidad de la cuenta → Nombre de la cuenta → Indicar justificación
 * El set "Campos editables en consola" sigue al final (io_set_item.order 10000, no se toca).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '1767b1041ba3761458f65425604bcb71';
var P = 'u_gest_cta_altpriv_t0_';
var ORDEN = ['accion_requerida', 'vigencia', 'caducidad_cuenta', 'nombre_cuenta', 'indicar_justificacion'];

gs.print('DRY_RUN = ' + DRY_RUN);
ORDEN.forEach(function (n, i) {
    var ord = (i + 1) * 100;
    var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', P + n); v.query();
    if (!v.next()) { gs.print('❌ No existe ' + P + n); return; }
    if (v.getValue('order') == String(ord)) { gs.print('• ' + n + ': ' + ord + ' (sin cambio)'); return; }
    gs.print('• ' + n + ': ' + v.getValue('order') + ' → ' + ord);
    if (!DRY_RUN) { v.setValue('order', ord); v.update(); }
});
gs.print('FIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
