/*
 * Google Cloud Platform — formulario EXACTO a la planilla
 *   Acción requerida: Otorgar/Modificar Acceso | Eliminar Acceso                      (obligatoria)
 *     Otorgar/Modificar → Vigencia (Definida → Caducidad vigencia, Fecha)              (obligatorias)
 *                       → Seleccione tipo de rol: Consola de administración / Dominio de datos (al menos una)
 *                            Dominio de datos → Indique nombre de matriz GCP           (obligatoria)
 *     Eliminar Acceso → nada más
 *   Indique cuenta T1 (no obligatoria) · Descripción de la solicitud (obligatoria) · célula (set, sin cambio)
 * 1) Se INACTIVAN (no se borran) las variables que no están en la planilla: colaborador/proveedor, posee T1,
 *    rol a eliminar, Proyecto y RBAC, con sus policies y el onChange de Colaborador.
 *    Ni el Flow ni Llenar Wo Types las usan (Flow: acción + célula; Wo Types: requested_for.*).
 * 2) Policies que quedan: condiciones solo con Acción = Otorgar/Modificar (sin colaborador) y borrar valor.
 * 3) onSubmit GCP_VALIDAR_ROL: ya no depende de colaborador (exige al menos un tipo de rol en Otorgar/Modificar).
 * 4) Textos: "Seleccione tipo de rol" y "Descripción de la solicitud" (+ traducción es).
 * 5) Orden como la planilla.
 * Values sin cambio → el Flow no se toca.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '0cd9733b1bfb3a5058f65425604bcb61';
var P = 'u_gcp_';
var FUERA = ['colaborador_proveedor', 'posee_cuenta_t1', 'indique_rol_eliminar', 'es_proyecto', 'requiere_rbac'];
var TEXTOS = { lbl_rol_admin: 'Seleccione tipo de rol', descripcion_solicitud: 'Descripción de la solicitud' };
var ORDEN = ['accion_requerida', 'vigencia', 'caducidad_vigencia', 'lbl_rol_admin', 'rol_consola_admin', 'rol_dominio_datos',
    'nombre_matriz', 'indique_cuenta_t1', 'descripcion_solicitud'];

gs.print('DRY_RUN = ' + DRY_RUN);
function varRec(n) { var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', P + n); v.query(); return v.next() ? v : null; }
var ID = {}; ['accion_requerida', 'vigencia', 'rol_dominio_datos'].concat(FUERA).concat(ORDEN).forEach(function (n) { var r = varRec(n); if (r) ID[n] = 'IO:' + r.getUniqueValue(); });
var NOMBRE = {}; for (var k in ID) NOMBRE[ID[k]] = k;
var OTORGAR = ID.accion_requerida + '=otorgar_modificar_acceso';
// policies que quedan: [nombre actual empieza con, nombre nuevo, condición, orden]
var POL = [
    ['Mostrar - Vigencia', 'Mostrar - Vigencia', OTORGAR + '^EQ', 100],
    ['Mostrar - Caducidad', 'Mostrar - Caducidad vigencia', OTORGAR + '^' + ID.vigencia + '=definida^EQ', 200],
    ['Mostrar - ¿Requiere rol', 'Mostrar - Seleccione tipo de rol', OTORGAR + '^EQ', 300],
    ['Mostrar - Seleccione tipo de rol', 'Mostrar - Seleccione tipo de rol', OTORGAR + '^EQ', 300],
    ['Mostrar - Nombre de matriz', 'Mostrar - Nombre de matriz (Dominio de datos)', OTORGAR + '^' + ID.rol_dominio_datos + '=true^EQ', 400],
    ['Obligatorio - ¿Esta solicitud', null, null, 500],
    ['Solo lectura', null, null, 900]
];

// 1) Variables fuera
gs.print('\n1) Variables que no están en la planilla → inactivar');
FUERA.forEach(function (n) {
    var v = varRec(n); if (!v) { gs.print('   ⚠️ no existe ' + P + n); return; }
    if (v.getValue('active') != '1') { gs.print('   • ' + n + ': ya inactiva'); return; }
    gs.print('   • ' + n + ' ("' + v.getValue('question_text') + '") → inactiva');
    if (!DRY_RUN) { v.setValue('active', false); v.update(); }
});

// 2) Policies
gs.print('\n2) Policies');
var p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID); p.addActiveQuery(); p.query();
while (p.next()) {
    var nom = p.getValue('short_description'), def = null;
    POL.forEach(function (d) { if (!def && nom.indexOf(d[0]) == 0) def = d; });
    var a = new GlideRecord('catalog_ui_policy_action'); a.addQuery('ui_policy', p.getUniqueValue()); a.query();
    var vars = [], soloFuera = true;
    while (a.next()) { var nv = NOMBRE[a.getValue('catalog_variable')] || '?'; vars.push(nv); if (FUERA.indexOf(nv) == -1 && nv != 'indique_cuenta_t1') soloFuera = false; }
    if (!def) {
        if (soloFuera || nom.indexOf('Indique cuenta T1') > -1) {
            gs.print('   • "' + nom + '" (' + vars.join(', ') + ') → inactivar');
            if (!DRY_RUN) { p.setValue('active', false); p.update(); }
        } else gs.print('   ⚠️ "' + nom + '" (' + vars.join(', ') + ') no está en la lista: no se toca, revisar');
        continue;
    }
    var cambios = [];
    if (def[1] && nom != def[1]) { cambios.push('nombre → "' + def[1] + '"'); p.setValue('short_description', def[1]); }
    if (def[2] && p.getValue('catalog_conditions') != def[2]) { cambios.push('cond → solo Otorgar/Modificar' + (def[2].indexOf('definida') > -1 ? ' + Definida' : def[2].indexOf('dominio') > -1 ? ' + Dominio de datos' : '')); p.setValue('catalog_conditions', def[2]); }
    if (p.getValue('order') != String(def[3])) { cambios.push('orden ' + p.getValue('order') + ' → ' + def[3]); p.setValue('order', def[3]); }
    gs.print('   • "' + nom + '"' + (cambios.length ? ': ' + cambios.join(' | ') : ': sin cambio'));
    if (cambios.length && !DRY_RUN) p.update();
    if (!def[2]) continue;
    var b = new GlideRecord('catalog_ui_policy_action'); b.addQuery('ui_policy', p.getUniqueValue()); b.query();
    while (b.next()) {
        var bn = NOMBRE[b.getValue('catalog_variable')] || '?';
        if (b.getValue('visible') != 'true' || b.getValue('value_action') == 'clearValue' || bn == 'lbl_rol_admin') continue;
        gs.print('     → ' + bn + ' | BORRAR VALOR');
        if (!DRY_RUN) { b.setValue('value_action', 'clearValue'); b.update(); }
    }
}

// 3) Client scripts
gs.print('\n3) Client scripts');
var cc = new GlideRecord('catalog_script_client'); cc.addQuery('cat_item', ITEM_ID); cc.addQuery('script', 'CONTAINS', 'GCP_LIMPIAR_COLAB'); cc.query();
if (cc.next() && cc.getValue('active') == '1') { gs.print('   • "' + cc.getValue('name') + '" → inactivar (Colaborador ya no existe)'); if (!DRY_RUN) { cc.setValue('active', false); cc.update(); } }
var VALIDAR =
    'function onSubmit() {\n' +
    '    // GCP_VALIDAR_ROL\n' +
    "    if (g_form.getValue('" + P + "accion_requerida') != 'otorgar_modificar_acceso') return true;\n" +
    "    var c1 = g_form.getValue('" + P + "rol_consola_admin') == 'true';\n" +
    "    var c2 = g_form.getValue('" + P + "rol_dominio_datos') == 'true';\n" +
    '    if (!c1 && !c2) {\n' +
    "        g_form.addErrorMessage('Seleccione tipo de rol: marque al menos una opción.');\n" +
    '        return false;\n' +
    '    }\n' +
    '    return true;\n' +
    '}';
var cv = new GlideRecord('catalog_script_client'); cv.addQuery('cat_item', ITEM_ID); cv.addQuery('script', 'CONTAINS', 'GCP_VALIDAR_ROL'); cv.query();
if (!cv.next()) gs.print('   ⚠️ no encontré GCP_VALIDAR_ROL');
else if (cv.getValue('script') == VALIDAR) gs.print('   • GCP_VALIDAR_ROL: sin cambio');
else {
    gs.print('   • "' + cv.getValue('name') + '" → "onSubmit - Validar Seleccione tipo de rol", código nuevo:\n' + VALIDAR);
    if (!DRY_RUN) { cv.setValue('name', 'onSubmit - Validar Seleccione tipo de rol'); cv.setValue('script', VALIDAR); cv.update(); }
}

// 4) Textos
gs.print('\n4) Textos');
for (var t in TEXTOS) {
    var v = varRec(t); if (!v) { gs.print('   ⚠️ no existe ' + P + t); continue; }
    if (v.getValue('question_text') != TEXTOS[t]) { gs.print('   • ' + t + ': "' + v.getValue('question_text') + '" → "' + TEXTOS[t] + '"'); if (!DRY_RUN) { v.setValue('question_text', TEXTOS[t]); v.update(); } }
    else gs.print('   • ' + t + ': sin cambio');
    var tr = new GlideRecord('sys_translated_text');
    tr.addQuery('tablename', 'item_option_new'); tr.addQuery('documentkey', v.getUniqueValue()); tr.addQuery('fieldname', 'question_text'); tr.addQuery('language', 'es'); tr.query();
    if (tr.next() && tr.getValue('value') != TEXTOS[t]) { gs.print('     traducción es "' + tr.getValue('value') + '" → "' + TEXTOS[t] + '"'); if (!DRY_RUN) { tr.setValue('value', TEXTOS[t]); tr.update(); } }
}

// 5) Orden
gs.print('\n5) Orden');
ORDEN.forEach(function (n, i) {
    var ord = (i + 1) * 100, v = varRec(n);
    if (!v) { gs.print('   ⚠️ no existe ' + P + n); return; }
    if (v.getValue('order') == String(ord)) return;
    gs.print('   • ' + n + ': ' + v.getValue('order') + ' → ' + ord);
    if (!DRY_RUN) { v.setValue('order', ord); v.update(); }
});
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
