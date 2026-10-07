/*
 * Gestión de Cuenta con Alto Privilegio T0 — Vigencia solo en "Crear cuenta" + Definida / Indefinida
 * 1) Vigencia deja de ser obligatoria en la variable (una variable obligatoria vacía no se puede ocultar)
 *    y la maneja la nueva policy "Mostrar - Vigencia" (accion=crear_cuenta → visible + obligatoria + borrar valor).
 * 2) Policy de Caducidad: condición accion=crear_cuenta ^ vigencia=definida, borrar valor, nombre con espacio.
 * 3) Opciones de Vigencia con ​ al final para que no salgan como Temporal / Permanente
 *    (traducción global de Kathy; no se toca). Los values no cambian.
 * 4) Orden de policies: Vigencia 100, Caducidad 200, Solo lectura 300.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '1767b1041ba3761458f65425604bcb71';
var P = 'u_gest_cta_altpriv_t0_';
var POL_VIG = 'Mostrar - Vigencia';
var POL_CAD = 'Mostrar - Caducidad de la cuenta';
var ZW = '​';

gs.print('DRY_RUN = ' + DRY_RUN);
function save(gr) { if (!DRY_RUN) gr.update(); }
function varRec(n) { var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', P + n); v.query(); return v.next() ? v : null; }
function IO(v) { return 'IO:' + v.getUniqueValue(); }
function polRec(pref) { var p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID); p.addQuery('short_description', 'STARTSWITH', pref); p.query(); return p.next() ? p : null; }

var acc = varRec('accion_requerida'), vig = varRec('vigencia'), cad = varRec('caducidad_cuenta');
if (!acc || !vig || !cad) { gs.print('❌ Falta alguna variable (accion_requerida / vigencia / caducidad_cuenta)'); }
else {
    var COND_VIG = IO(acc) + '=crear_cuenta^EQ';
    var COND_CAD = IO(acc) + '=crear_cuenta^' + IO(vig) + '=definida^EQ';

    // 1) Vigencia no obligatoria en la variable
    gs.print('\n1) ' + P + 'vigencia | obligatoria ' + vig.getValue('mandatory') + ' → 0');
    if (vig.getValue('mandatory') == '1') { vig.setValue('mandatory', false); save(vig); }

    // Policy de Caducidad (se usa también como base para clonar)
    var pc = polRec('Mostrar -Caducidad') || polRec('Mostrar - Caducidad');
    if (!pc) { gs.print('❌ No encontré la policy de Caducidad'); }
    else {
        // Policy Vigencia
        gs.print('\n1b) Policy "' + POL_VIG + '"');
        var pv = polRec(POL_VIG);
        if (pv) gs.print('   ya existe (' + pv.getUniqueValue() + ')');
        else {
            gs.print('   crear | cond: accion_requerida=crear_cuenta | onLoad + invertir | cat/ritm/task como Caducidad | orden 100');
            gs.print('   → vigencia | visible=true oblig=true | BORRAR VALOR');
            if (!DRY_RUN) {
                var np = new GlideRecord('catalog_ui_policy'); np.get(pc.getUniqueValue());
                np.setValue('short_description', POL_VIG); np.setValue('catalog_conditions', COND_VIG); np.setValue('order', 100);
                var npId = np.insert();
                // la acción se copia de la de Caducidad (mismos campos internos) cambiando policy y variable
                var na = new GlideRecord('catalog_ui_policy_action'); na.addQuery('ui_policy', pc.getUniqueValue()); na.query();
                if (!na.next()) gs.print('   ❌ la policy de Caducidad no tiene acción para copiar');
                else {
                    na.setValue('ui_policy', npId); na.setValue('catalog_variable', IO(vig));
                    if (na.isValidField('variable')) na.setValue('variable', vig.getValue('name'));
                    na.setValue('visible', 'true'); na.setValue('mandatory', 'true');
                    na.setValue('disabled', 'ignore'); na.setValue('value_action', 'clearValue');
                    gs.print('   sys_id policy: ' + npId + ' | acción: ' + na.insert());
                }
            }
        }

        // 2) Policy Caducidad
        gs.print('\n2) Policy "' + pc.getValue('short_description') + '"');
        if (pc.getValue('short_description') != POL_CAD) { gs.print('   nombre → "' + POL_CAD + '"'); pc.setValue('short_description', POL_CAD); }
        if (pc.getValue('catalog_conditions') != COND_CAD) { gs.print('   cond → accion_requerida=crear_cuenta ^ vigencia=definida'); pc.setValue('catalog_conditions', COND_CAD); }
        if (pc.getValue('order') != '200') { gs.print('   orden ' + pc.getValue('order') + ' → 200'); pc.setValue('order', 200); }
        save(pc);
        var ca = new GlideRecord('catalog_ui_policy_action'); ca.addQuery('ui_policy', pc.getUniqueValue()); ca.addQuery('catalog_variable', IO(cad)); ca.query();
        if (ca.next() && ca.getValue('value_action') != 'clearValue') { gs.print('   → caducidad_cuenta | BORRAR VALOR'); ca.setValue('value_action', 'clearValue'); save(ca); }
    }

    // Solo lectura al final
    var ps = polRec('Solo lectura');
    if (ps && ps.getValue('order') != '300') { gs.print('\n   Solo lectura orden ' + ps.getValue('order') + ' → 300'); ps.setValue('order', 300); save(ps); }

    // 3) Opciones con ​
    gs.print('\n3) Opciones de Vigencia');
    var c = new GlideRecord('question_choice'); c.addQuery('question', vig.getUniqueValue()); c.orderBy('order'); c.query();
    while (c.next()) {
        var t = c.getValue('text');
        if (t.indexOf(ZW) > -1) { gs.print('   • ' + c.getValue('value') + ' = "' + t.replace(ZW, '') + '" ya tiene \\u200B'); continue; }
        gs.print('   • ' + c.getValue('value') + ' = "' + t + '" → "' + t + '\\u200B"');
        c.setValue('text', t + ZW); save(c);
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
