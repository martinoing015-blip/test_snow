/*
 * Gestión de Cuenta con Alto Privilegio T1 — ajustes según la planilla de Remedy
 * (incluye lo de t1_usuario_dominio_y_caducidad.js: si ya se corrió, esa parte sale "sin cambio")
 * Las NOTAS de Habilitar y Desvincular MFA se quedan como texto de ayuda normal (no se tocan).
 * 1) Usuario Dominio: la lista muestra solo el username (ref_ac_columns=user_name, sin display value)
 *    y el texto pierde el espacio inicial (" Usuario Dominio" → "Usuario Dominio").
 * 2) "Rut" → "RUT" (como la planilla).
 * 3) Caducidad vigencia: Texto (6) → Fecha (9).
 * 4) Policies "Mostrar - …": borrar valor al ocultar; "Mostrar - Crear cuenta" → "Mostrar - Crear o Modificar cuenta".
 * 5) Orden de variables de 100 en 100 como la planilla.
 * En cada texto que cambia se actualiza también la traducción es (si existe).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '4adb81813bddc7902815757e53e45a22';
var P = 'u_gest_cta_altpriv_t1_';
var ATTRS = {
    ref_auto_completer: 'AJAXTableCompleter',
    ref_ac_columns: 'user_name',
    ref_ac_columns_search: 'true',
    ref_ac_display_value: 'false'
};
var TEXTOS = { usuario_dominio: 'Usuario Dominio', usuario_rut: 'RUT' };
var ORDEN = ['usuario_dominio', 'usuario_rut', 'usuario_nombre_completo', 'accion_requerida',
    'indique_usuario_modificar', 'requiere_acceso_servidores', 'servidores_requiere_acceso', 'requiere_acceso_nubes',
    'texto_enriquecido', 'periodo_vigencia', 'caducidad_vigencia', 'indique_usuario_habilitar',
    'indique_usuario_desvincular_mfa', 'indique_usuario_eliminar', 'justificacion', 'proyecto', 'proyecto_nombre'];

gs.print('DRY_RUN = ' + DRY_RUN);
function varRec(n) { var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', P + n); v.query(); return v.next() ? v : null; }
function trRec(table, id, field) {
    var t = new GlideRecord('sys_translated_text');
    t.addQuery('tablename', table); t.addQuery('documentkey', id); t.addQuery('fieldname', field); t.addQuery('language', 'es'); t.query();
    return t.next() ? t : null;
}

// 1) Usuario Dominio: atributos
gs.print('\n1) Usuario Dominio');
var u = varRec('usuario_dominio');
if (!u) gs.print('❌ No existe ' + P + 'usuario_dominio');
else {
    var actual = u.getValue('attributes') || '', mapa = {}, orden = [];
    actual.split(',').forEach(function (x) {
        if (!x.trim()) return;
        var k = x.split('=')[0].trim(); if (!(k in mapa)) orden.push(k); mapa[k] = x.substring(x.indexOf('=') + 1).trim();
    });
    for (var k in ATTRS) { if (!(k in mapa)) orden.push(k); mapa[k] = ATTRS[k]; }
    var nuevo = orden.map(function (k) { return k + '=' + mapa[k]; }).join(',');
    if (nuevo == actual) gs.print('   attributes sin cambio');
    else { gs.print('   attributes: "' + actual + '"\n   → "' + nuevo + '"'); if (!DRY_RUN) { u.setValue('attributes', nuevo); u.update(); } }
}

// 1b y 2) Textos (+ traducción es)
gs.print('\n2) Textos');
for (var n in TEXTOS) {
    var v = varRec(n); if (!v) { gs.print('❌ No existe ' + P + n); continue; }
    if (v.getValue('question_text') != TEXTOS[n]) {
        gs.print('   • ' + n + ': "' + v.getValue('question_text') + '" → "' + TEXTOS[n] + '"');
        if (!DRY_RUN) { v.setValue('question_text', TEXTOS[n]); v.update(); }
    } else gs.print('   • ' + n + ': sin cambio');
    var t = trRec('item_option_new', v.getUniqueValue(), 'question_text');
    if (t && t.getValue('value') != TEXTOS[n]) {
        gs.print('     traducción es: "' + t.getValue('value') + '" → "' + TEXTOS[n] + '"');
        if (!DRY_RUN) { t.setValue('value', TEXTOS[n]); t.update(); }
    }
}

// 3) Caducidad vigencia → Fecha
gs.print('\n3) Caducidad vigencia');
var c = varRec('caducidad_vigencia');
if (!c) gs.print('❌ No existe ' + P + 'caducidad_vigencia');
else if (c.getValue('type') == '9') gs.print('   ya es Fecha');
else { gs.print('   ' + c.getDisplayValue('type') + ' (' + c.getValue('type') + ') → Fecha (9)'); if (!DRY_RUN) { c.setValue('type', 9); c.update(); } }

// 4) Policies
gs.print('\n4) Policies');
var NOMBRE = {}, mv = new GlideRecord('item_option_new'); mv.addQuery('cat_item', ITEM_ID); mv.query();
while (mv.next()) NOMBRE['IO:' + mv.getUniqueValue()] = mv.getValue('name').replace(P, '');
var p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID); p.addQuery('short_description', 'STARTSWITH', 'Mostrar - '); p.orderBy('order'); p.query();
while (p.next()) {
    var nom = p.getValue('short_description');
    if (nom == 'Mostrar - Crear cuenta') {
        gs.print('   • "' + nom + '" → "Mostrar - Crear o Modificar cuenta"');
        if (!DRY_RUN) { p.setValue('short_description', 'Mostrar - Crear o Modificar cuenta'); p.update(); }
    }
    var a = new GlideRecord('catalog_ui_policy_action'); a.addQuery('ui_policy', p.getUniqueValue()); a.query();
    while (a.next()) {
        if (a.getValue('visible') != 'true' || a.getValue('value_action') == 'clearValue') continue;
        if (NOMBRE[a.getValue('catalog_variable')] == 'texto_enriquecido') continue;   // etiqueta: no tiene valor
        gs.print('   • ' + nom + ' → ' + (NOMBRE[a.getValue('catalog_variable')] || a.getValue('catalog_variable')) + ' | BORRAR VALOR');
        if (!DRY_RUN) { a.setValue('value_action', 'clearValue'); a.update(); }
    }
}

// 5) Orden
gs.print('\n5) Orden');
ORDEN.forEach(function (n, i) {
    var ord = (i + 1) * 100, v = varRec(n);
    if (!v) { gs.print('❌ No existe ' + P + n); return; }
    if (v.getValue('order') == String(ord)) return;
    gs.print('   • ' + n + ': ' + v.getValue('order') + ' → ' + ord);
    if (!DRY_RUN) { v.setValue('order', ord); v.update(); }
});
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
