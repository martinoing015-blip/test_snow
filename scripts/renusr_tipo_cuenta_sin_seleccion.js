/*
 * Renombrar Usuario Interno/Externo — "Tipo de Cuenta" parte sin opción marcada
 * Sin "-- Ninguno --" el portal marca solo la primera opción; este onLoad la deja vacía.
 * Corre SOLO en el formulario del catálogo (no en RITM ni tareas, ahí borraría lo elegido).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = 'a79c4c131b58cb1058f65425604bcb0d';
var VAR_NAME = 'u_ren_usr_int_ext_tipo_cuenta';
var NOMBRE = 'onLoad - Tipo de Cuenta sin selección';
var MARCADOR = 'RENUSR_TIPO_CUENTA_VACIA';
var CODIGO =
    'function onLoad() {\n' +
    '    // ' + MARCADOR + '\n' +
    '    g_form.clearValue(\'' + VAR_NAME + '\');\n' +
    '}';

gs.print('DRY_RUN = ' + DRY_RUN);
var v = new GlideRecord('item_option_new');
v.addQuery('cat_item', ITEM_ID); v.addQuery('name', VAR_NAME); v.query();
if (!v.next()) gs.print('❌ No existe ' + VAR_NAME);
else {
    var cs = new GlideRecord('catalog_script_client');
    cs.addQuery('cat_item', ITEM_ID); cs.addQuery('script', 'CONTAINS', MARCADOR); cs.query();
    if (cs.next()) {
        gs.print('• ya existe "' + cs.getValue('name') + '" (' + MARCADOR + ') | activo=' + cs.getValue('active') +
            ' | catálogo=' + cs.getValue('applies_catalog') + ' ritm=' + cs.getValue('applies_req_item') + ' tarea=' + cs.getValue('applies_sc_task'));
    } else {
        gs.print('• crear "' + NOMBRE + '" | onLoad | solo catálogo (no RITM, no tarea) | todas las interfaces');
        gs.print(CODIGO);
        if (!DRY_RUN) {
            cs.initialize();
            cs.setValue('name', NOMBRE);
            cs.setValue('cat_item', ITEM_ID);
            cs.setValue('type', 'onLoad');
            cs.setValue('script', CODIGO);
            cs.setValue('active', true);
            if (cs.isValidField('ui_type')) cs.setValue('ui_type', 10);              // Todas (escritorio + portal)
            if (cs.isValidField('applies_catalog')) cs.setValue('applies_catalog', true);
            if (cs.isValidField('applies_req_item')) cs.setValue('applies_req_item', false);
            if (cs.isValidField('applies_sc_task')) cs.setValue('applies_sc_task', false);
            if (cs.isValidField('applies_target_record')) cs.setValue('applies_target_record', false);
            gs.print('  sys_id: ' + cs.insert());
        }
    }
}
gs.print('FIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
