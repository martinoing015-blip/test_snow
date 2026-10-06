/*
 * Solicitud Masiva Entorno Multicloud — Modificación igual que Creación (como Remedy)
 *   Las policies activas que hoy dicen "accion = Creación" pasan a "accion = Creación O Modificación"
 *   (ambiente, rol, rol GCP, posee T1, cuenta T1, matriz GCP, vigencia, caducidad).
 *
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 * Se puede correr más de una vez: lo que ya está bien no se toca.
 */
var DRY_RUN = true;
var ITEM_ID = '31c840631be3325058f65425604bcb53';
var P = 'u_sol_mas_ent_mcld_';

gs.print('DRY_RUN = ' + DRY_RUN);
var acc = new GlideRecord('item_option_new');
acc.addQuery('cat_item', ITEM_ID); acc.addQuery('name', P + 'accion_requerida'); acc.query();
if (!acc.next()) gs.print('❌ No existe ' + P + 'accion_requerida');
else {
    var IO = 'IO:' + acc.getUniqueValue();
    var viejo = IO + '=otorgar_modificar_acceso^', nuevo = IO + '=otorgar_modificar_acceso^OR' + IO + '=modificacion^';

    // confirmar que la opción modificacion existe y está activa
    var ch = new GlideRecord('question_choice');
    ch.addQuery('question', acc.getUniqueValue()); ch.addQuery('value', 'modificacion'); ch.query();
    if (!ch.next()) gs.print('❌ accion_requerida no tiene la opción modificacion');
    else gs.print('• opción modificacion = "' + ch.getValue('text') + '"' + (ch.getValue('inactive') == '1' ? ' ⚠️ INACTIVA' : ''));

    gs.print('\n--- POLICIES');
    var n = 0;
    var p = new GlideRecord('catalog_ui_policy');
    p.addQuery('catalog_item', ITEM_ID); p.addQuery('active', true); p.orderBy('order'); p.query();
    while (p.next()) {
        var cond = p.getValue('catalog_conditions') || '';
        if (cond.indexOf(viejo) == -1) continue;
        if (cond.indexOf(nuevo) > -1) { gs.print('• "' + p.getValue('short_description') + '": ya incluye Modificación'); continue; }
        gs.print('• "' + p.getValue('short_description') + '": accion=Creación → accion=Creación O Modificación');
        p.setValue('catalog_conditions', cond.split(viejo).join(nuevo));
        if (!DRY_RUN) p.update();
        n++;
    }
    gs.print('Policies a cambiar: ' + n);
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
