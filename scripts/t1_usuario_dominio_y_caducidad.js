/*
 * Gestión de Cuenta con Alto Privilegio T1 — 2 correcciones pedidas en la revisión
 * 1) Usuario Dominio: en el input queda el username (user_name), no el nombre completo
 *    (el nombre ya se autollena abajo en "Nombre completo"). Se hace con atributos de la variable:
 *    la lista muestra y busca por user_name y no muestra el display value (name).
 * 2) Caducidad vigencia: Texto de una sola línea (6) → Fecha (9).
 *    Ojo: si hay RITM antiguos con texto en este campo, pueden verse raros (instancia dev).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '4adb81813bddc7902815757e53e45a22';
var P = 'u_gest_cta_altpriv_t1_';
var ATTRS = {
    ref_auto_completer: 'AJAXTableCompleter',
    ref_ac_columns: 'user_name;name',
    ref_ac_columns_search: 'true',
    ref_ac_display_value: 'false'
};

gs.print('DRY_RUN = ' + DRY_RUN);
function varRec(n) { var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', P + n); v.query(); return v.next() ? v : null; }

// 1) Usuario Dominio
var u = varRec('usuario_dominio');
if (!u) gs.print('❌ No existe ' + P + 'usuario_dominio');
else {
    // mantiene los atributos que ya tenga y agrega / reemplaza los de ATTRS
    var actual = u.getValue('attributes') || '', mapa = {}, orden = [];
    actual.split(',').forEach(function (x) {
        if (!x.trim()) return;
        var k = x.split('=')[0].trim(); if (!(k in mapa)) orden.push(k); mapa[k] = x.substring(x.indexOf('=') + 1).trim();
    });
    for (var k in ATTRS) { if (!(k in mapa)) orden.push(k); mapa[k] = ATTRS[k]; }
    var nuevo = orden.map(function (k) { return k + '=' + mapa[k]; }).join(',');
    gs.print('1) ' + P + 'usuario_dominio | attributes: "' + actual + '"');
    gs.print('   → "' + nuevo + '"');
    if (nuevo != actual && !DRY_RUN) { u.setValue('attributes', nuevo); u.update(); }
}

// 2) Caducidad vigencia
var c = varRec('caducidad_vigencia');
if (!c) gs.print('❌ No existe ' + P + 'caducidad_vigencia');
else if (c.getValue('type') == '9') gs.print('2) ' + P + 'caducidad_vigencia ya es Fecha');
else {
    var ritm = new GlideAggregate('sc_item_option_mtom');
    ritm.addQuery('sc_item_option.item_option_new', c.getUniqueValue()); ritm.addNotNullQuery('sc_item_option.value'); ritm.addAggregate('COUNT'); ritm.query();
    var n = ritm.next() ? ritm.getAggregate('COUNT') : 0;
    gs.print('2) ' + P + 'caducidad_vigencia | ' + c.getDisplayValue('type') + ' (' + c.getValue('type') + ') → Fecha (9) | RITM con valor: ' + n);
    if (!DRY_RUN) { c.setValue('type', 9); c.update(); }
}
gs.print('FIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
