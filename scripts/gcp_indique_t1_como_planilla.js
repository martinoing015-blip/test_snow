/*
 * Google Cloud Platform — observación de la revisión: falta "Indique cuenta T1" como en la planilla
 * (en la planilla va siempre visible y NO obligatoria).
 * 1) Policy "Mostrar - Indique cuenta T1": deja de ocultar el campo (visible=ignore) y solo lo hace obligatorio
 *    cuando es Eliminación + colaborador interno + posee T1 = Sí (como Remedy). Pasa a llamarse
 *    "Obligatorio - Indique cuenta T1 (Eliminación con T1)".
 * 2) Client scripts GCP_LIMPIAR_ACCION / _COLAB / _POSEE ya no borran indique_cuenta_t1 (ahora está siempre a la vista);
 *    si a alguno no le queda nada que limpiar, se inactiva.
 * 3) Casilla "Consola Admnistración" (typo) → "Consola de administración" (como la planilla, + traducción es).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '0cd9733b1bfb3a5058f65425604bcb61';
var P = 'u_gcp_';
var T1 = P + 'indique_cuenta_t1';
var POL_NUEVO = 'Obligatorio - Indique cuenta T1 (Eliminación con T1)';
var CONSOLA_TXT = 'Consola de administración';

gs.print('DRY_RUN = ' + DRY_RUN);
function varRec(n) { var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', n); v.query(); return v.next() ? v : null; }
var t1 = varRec(T1);
if (!t1) gs.print('❌ No existe ' + T1);
else {
    gs.print('\n0) ' + T1 + ' | obligatoria en la variable=' + t1.getValue('mandatory') + (t1.getValue('mandatory') == '1' ? ' → 0' : ' (ok)'));
    if (!DRY_RUN && t1.getValue('mandatory') == '1') { t1.setValue('mandatory', false); t1.update(); }

    // 1) Policy
    gs.print('\n1) Policy');
    var p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID);
    var q = p.addQuery('short_description', 'STARTSWITH', 'Mostrar - Indique cuenta T1'); q.addOrCondition('short_description', POL_NUEVO); p.query();
    if (!p.next()) gs.print('❌ No encontré la policy de Indique cuenta T1');
    else {
        if (p.getValue('short_description') != POL_NUEVO) { gs.print('   "' + p.getValue('short_description') + '" → "' + POL_NUEVO + '"'); if (!DRY_RUN) { p.setValue('short_description', POL_NUEVO); p.update(); } }
        var a = new GlideRecord('catalog_ui_policy_action'); a.addQuery('ui_policy', p.getUniqueValue()); a.addQuery('catalog_variable', 'IO:' + t1.getUniqueValue()); a.query();
        if (!a.next()) gs.print('❌ La policy no tiene acción sobre ' + T1);
        else {
            gs.print('   → indique_cuenta_t1 | visible ' + a.getValue('visible') + ' → ignore | oblig ' + a.getValue('mandatory') + ' → true' + (a.getValue('value_action') == 'clearValue' ? ' | quitar BORRAR VALOR' : ''));
            if (!DRY_RUN) { a.setValue('visible', 'ignore'); a.setValue('mandatory', 'true'); if (a.getValue('value_action') == 'clearValue') a.setValue('value_action', 'ignore'); a.update(); }
        }
    }

    // 2) Client scripts
    gs.print('\n2) Client scripts');
    ['GCP_LIMPIAR_ACCION', 'GCP_LIMPIAR_COLAB', 'GCP_LIMPIAR_POSEE'].forEach(function (mk) {
        var cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.addQuery('script', 'CONTAINS', mk); cs.query();
        if (!cs.next()) { gs.print('   ⚠️ no encontré ' + mk); return; }
        var code = cs.getValue('script'), mt = code.match(/var campos = (\[[^\]]*\]);/);
        if (!mt) { gs.print('   ⚠️ ' + mk + ': no encontré "var campos = [...]", revisar a mano'); return; }
        var campos = JSON.parse(mt[1]);
        if (campos.indexOf(T1) == -1) { gs.print('   • ' + cs.getValue('name') + ': ya no borra indique_cuenta_t1'); return; }
        campos = campos.filter(function (c) { return c != T1; });
        if (!campos.length) {
            gs.print('   • ' + cs.getValue('name') + ' (' + mk + '): solo borraba indique_cuenta_t1 → inactivar');
            if (!DRY_RUN) { cs.setValue('active', false); cs.update(); }
        } else {
            gs.print('   • ' + cs.getValue('name') + ' (' + mk + '): quitar indique_cuenta_t1 → ' + JSON.stringify(campos));
            if (!DRY_RUN) { cs.setValue('script', code.replace(mt[0], 'var campos = ' + JSON.stringify(campos) + ';')); cs.update(); }
        }
    });
}

// 3) Typo Consola
gs.print('\n3) Casilla Consola');
var c = varRec(P + 'rol_consola_admin');
if (!c) gs.print('❌ No existe ' + P + 'rol_consola_admin');
else {
    if (c.getValue('question_text') != CONSOLA_TXT) { gs.print('   "' + c.getValue('question_text') + '" → "' + CONSOLA_TXT + '"'); if (!DRY_RUN) { c.setValue('question_text', CONSOLA_TXT); c.update(); } }
    else gs.print('   sin cambio');
    var tr = new GlideRecord('sys_translated_text');
    tr.addQuery('tablename', 'item_option_new'); tr.addQuery('documentkey', c.getUniqueValue()); tr.addQuery('fieldname', 'question_text'); tr.addQuery('language', 'es'); tr.query();
    if (tr.next() && tr.getValue('value') != CONSOLA_TXT) { gs.print('   traducción es "' + tr.getValue('value') + '" → "' + CONSOLA_TXT + '"'); if (!DRY_RUN) { tr.setValue('value', CONSOLA_TXT); tr.update(); } }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
