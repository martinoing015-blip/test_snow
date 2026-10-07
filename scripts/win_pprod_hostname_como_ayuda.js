/*
 * Gestión de cuenta en servidores Windows Pre-productivo — "Ambiente / Hostname / Dirección IP" como ayuda
 * Convención: lo que en Remedy es texto enriquecido va como TEXTO DE AYUDA SIEMPRE VISIBLE en la variable
 * que corresponde (no como etiqueta).
 * 1) u_gest_cta_srv_win_pprod_indique_srv_que_requiere_acceso: help_text "Ambiente / Hostname / Dirección IP",
 *    show_help + show_help_on_load, y traducción es del help_text.
 * 2) Se inactiva la etiqueta u_gest_cta_srv_win_pprod_amb_hostname_dir_ip_texto (creada por win_pprod_hostname_y_adjunto.js).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '716b40cf1b5ffad058f65425604bcb17';
var P = 'u_gest_cta_srv_win_pprod_';
var VAR = P + 'indique_srv_que_requiere_acceso';
var ETIQUETA = P + 'amb_hostname_dir_ip_texto';
var AYUDA = 'Ambiente / Hostname / Dirección IP';

gs.print('DRY_RUN = ' + DRY_RUN);
function varRec(n) { var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', n); v.query(); return v.next() ? v : null; }

// 1) Ayuda visible
gs.print('\n1) ' + VAR);
var v = varRec(VAR);
if (!v) gs.print('❌ No existe');
else {
    gs.print('   ayuda: "' + (v.getValue('help_text') || '') + '" → "' + AYUDA + '" | show_help ' + v.getValue('show_help') + ' → 1' +
        (v.isValidField('show_help_on_load') ? ' | show_help_on_load ' + v.getValue('show_help_on_load') + ' → 1' : ''));
    if (!DRY_RUN) {
        v.setValue('help_text', AYUDA); v.setValue('show_help', true);
        if (v.isValidField('show_help_on_load')) v.setValue('show_help_on_load', true);
        v.update();
    }
    var t = new GlideRecord('sys_translated_text');
    t.addQuery('tablename', 'item_option_new'); t.addQuery('documentkey', v.getUniqueValue()); t.addQuery('fieldname', 'help_text'); t.addQuery('language', 'es'); t.query();
    if (t.next()) {
        gs.print('   traducción es: "' + t.getValue('value') + '" → "' + AYUDA + '"');
        if (!DRY_RUN) { t.setValue('value', AYUDA); t.update(); }
    } else {
        gs.print('   traducción es: crear "' + AYUDA + '"');
        if (!DRY_RUN) {
            t.initialize(); t.setValue('tablename', 'item_option_new'); t.setValue('documentkey', v.getUniqueValue());
            t.setValue('fieldname', 'help_text'); t.setValue('language', 'es'); t.setValue('value', AYUDA); t.insert();
        }
    }
}

// 2) Etiqueta fuera
gs.print('\n2) ' + ETIQUETA);
var e = varRec(ETIQUETA);
if (!e) gs.print('   no existe (nada que hacer)');
else if (e.getValue('active') != '1') gs.print('   ya está inactiva');
else { gs.print('   activa → inactivar'); if (!DRY_RUN) { e.setValue('active', false); e.update(); } }
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
