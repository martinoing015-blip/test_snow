/*
 * Practicantes — etiquetas del solicitante en el portal.
 * El portal sigue mostrando "Nombres Del" / "Apellidos Del" aunque el texto base ya dice "del": la etiqueta viene de una
 * traducción guardada en otra tabla / campo. Este script busca TODAS las traducciones (sys_translated_text, cualquier tabla)
 * de las variables del solicitante y las deja igual al texto que se indica en TEXTOS.
 * También cambia la etiqueta "Usuario Dominio Solicitante" si se pone otro texto en TEXTOS.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = 'a6837d761b5736d0d4f1a756624bcb09';
var TEXTOS = {
    u_prac_usuario_dominio_solicitante: 'Usuario Dominio Solicitante',   // cambiar aquí si piden otra etiqueta (ej. 'Nombre completo del Solicitante')
    u_prac_rut_solicitante: 'Rut del Solicitante',
    u_prac_nombres_solicitante: 'Nombres del Solicitante',
    u_prac_apellidos_solicitante: 'Apellidos del Solicitante',
    u_prac_username_solicitante: 'Usuario de Dominio del Solicitante'
};

gs.print('DRY_RUN = ' + DRY_RUN);
for (var name in TEXTOS) {
    var nuevo = TEXTOS[name];
    var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', name); v.query();
    if (!v.next()) { gs.print('\n❌ ' + name + ': no existe'); continue; }
    gs.print('\n=== ' + name + ' | base: "' + v.getValue('question_text') + '"');
    if (v.getValue('question_text') != nuevo) {
        gs.print('   • base → "' + nuevo + '"');
        if (!DRY_RUN) { v.setValue('question_text', nuevo); v.update(); }
    }
    var t = new GlideRecord('sys_translated_text'); t.addQuery('documentkey', v.getUniqueValue()); t.query();
    if (!t.hasNext()) gs.print('   (sin traducciones)');
    while (t.next()) {
        var campo = t.getValue('fieldname'), ok = t.getValue('value') == nuevo;
        gs.print('   traducción ' + t.getValue('tablename') + '.' + campo + ' [' + t.getValue('language') + ']: "' + t.getValue('value') + '"' +
            (campo != 'question_text' ? '' : ok ? ' (ok)' : ' → "' + nuevo + '"'));
        if (!DRY_RUN && campo == 'question_text' && !ok) { t.setValue('value', nuevo); t.update(); }
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
