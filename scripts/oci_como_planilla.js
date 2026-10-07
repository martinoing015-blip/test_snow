/*
 * Oracle Cloud Infrastructure — formulario EXACTO a la planilla V2 (revisión: "la pregunta de proyecto se debe eliminar"
 *   y "algunas preguntas condicionales según acción requerida también fueron eliminadas")
 *   Acción Requerida: Otorgar/Modificar Acceso | Eliminar Acceso                         (obligatoria)
 *     Otorgar/Modificar → Vigencia (Definida → Caducidad vigencia, Fecha, obligatoria)
 *     Eliminar Acceso → nada más
 *   Indique cuenta T1 (texto, obligatoria) · Descripción de la solicitud (obligatoria) · célula (set, sin cambio)
 * 1) Se INACTIVAN (no se borran) los campos que no están en la planilla: ¿Colaborador interno o proveedor?,
 *    Indique rol a eliminar, ¿Requiere rol administrativo?, ¿Posee cuenta T1? y Proyecto, y sus policies.
 *    Ni el Flow (acción + célula) ni Llenar Wo Types (requested_for.*) los usan.
 * 2) "Indique cuenta T1" queda siempre visible y obligatoria (como la planilla); su policy (dependía de Posee T1) se inactiva.
 * 3) Policies: Vigencia y Caducidad (condición simplificada: Otorgar/Modificar + Definida) con borrar valor;
 *    "Mostrar -  Obligatoriedad Seleccione Célula" → "Obligatorio - ¿Esta solicitud está asociada a una célula?"; orden.
 * 4) onChange de Acción: ya no borra Descripción, Proyecto ni cuenta T1 (solo Vigencia y Caducidad), sin const/flechas,
 *    con marcador OCI_LIMPIAR_ACCION.
 * 5) Textos que el portal muestra cambiados por traducción global: "Eliminar Acceso" (salía "Eliminar"),
 *    "Definida" / "Indefinida" (salían "Temporal" / "Permanente") → \u200B al final. Values sin cambio.
 * 6) Orden como la planilla.
 * VIGENCIA_OBLIGATORIA: la planilla deja en blanco "obligatorio" de Vigencia; se mantiene obligatoria (true).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var VIGENCIA_OBLIGATORIA = true;
var ITEM_ID = 'aa0fe7a61bf37e10d4f1a756624bcbc2';
var P = 'oci_';
var FUERA = ['colaborador_interno_o_proveedor', 'indique_rol_a_eliminar', 'requiere_rol_administrativo', 'posee_cuenta_t1', 'proyecto'];
var POL_FUERA = ['Mostrar - Requiere rol admin', 'Mostrar - Colaborador interno o proveedor', 'Mostrar - Indique cuenta T1', 'Mostrar - Indique rol a eliminar', 'Mostrar - Posee cuenta T1'];
var ORDEN = ['accion_requerida', 'vigencia', 'caducidad_vigencia', 'cuenta_t1', 'descripcion_solicitud'];
var ZW = '\u200B';

gs.print('DRY_RUN = ' + DRY_RUN);
function varRec(n) { var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', P + n); v.query(); return v.next() ? v : null; }
function trEs(text) {
    var t = new GlideRecord('sys_translated'); t.addQuery('name', 'question_choice'); t.addQuery('element', 'text');
    t.addQuery('value', text); t.addQuery('language', 'es'); t.query(); return t.next() ? t.getValue('label') : '';
}
var ID = {}; ORDEN.concat(FUERA).forEach(function (n) { var r = varRec(n); if (r) ID[n] = 'IO:' + r.getUniqueValue(); });
var NOMBRE = {}; for (var k in ID) NOMBRE[ID[k]] = k;

// 1) Fuera
gs.print('\n1) Campos que no están en la planilla → inactivar');
FUERA.forEach(function (n) {
    var v = varRec(n); if (!v) { gs.print('   ⚠️ no existe ' + P + n); return; }
    if (v.getValue('active') != '1') { gs.print('   • ' + n + ': ya inactiva'); return; }
    gs.print('   • ' + n + ' ("' + v.getValue('question_text') + '") → inactiva');
    if (!DRY_RUN) { v.setValue('active', false); v.update(); }
});

// 2) Indique cuenta T1 (siempre visible, obligatoria)
gs.print('\n2) Indique cuenta T1');
var t1 = varRec('cuenta_t1');
if (!t1) gs.print('   ❌ no existe ' + P + 'cuenta_t1');
else {
    gs.print('   activa ' + t1.getValue('active') + ' → 1 | obligatoria ' + t1.getValue('mandatory') + ' → 1 | texto "' + t1.getValue('question_text') + '"');
    if (!DRY_RUN) { t1.setValue('active', true); t1.setValue('mandatory', true); t1.update(); }
}

// 3) Policies
gs.print('\n3) Policies');
var POL = [   // [empieza con, nombre nuevo, orden, condición nueva o null]
    ['Mostrar - Vigencia', 'Mostrar - Vigencia', 100, ID.accion_requerida + '=otorgar_modificar_acceso^EQ'],
    ['Mostrar - Caducidad', 'Mostrar - Caducidad vigencia', 200, ID.accion_requerida + '=otorgar_modificar_acceso^' + ID.vigencia + '=definida^EQ'],
    ['Mostrar -  Obligatoriedad', 'Obligatorio - ¿Esta solicitud está asociada a una célula?', 300, null],
    ['Obligatorio - ¿Esta solicitud', 'Obligatorio - ¿Esta solicitud está asociada a una célula?', 300, null],
    ['Solo lectura', 'Solo lectura', 900, null]
];
var p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID); p.addActiveQuery(); p.query();
while (p.next()) {
    var nom = p.getValue('short_description'), def = null;
    POL.forEach(function (d) { if (!def && nom.indexOf(d[0]) == 0) def = d; });
    if (!def) {
        if (POL_FUERA.some(function (x) { return nom.indexOf(x) == 0; })) { gs.print('   • "' + nom + '" → inactivar'); if (!DRY_RUN) { p.setValue('active', false); p.update(); } }
        else gs.print('   ⚠️ "' + nom + '" no reconocida, no se toca');
        continue;
    }
    var cambios = [];
    if (nom != def[1]) { cambios.push('nombre → "' + def[1] + '"'); p.setValue('short_description', def[1]); }
    if (p.getValue('order') != String(def[2])) { cambios.push('orden ' + p.getValue('order') + ' → ' + def[2]); p.setValue('order', def[2]); }
    if (def[3] && p.getValue('catalog_conditions') != def[3]) { cambios.push('cond → Otorgar/Modificar' + (def[3].indexOf('definida') > -1 ? ' + Definida' : '')); p.setValue('catalog_conditions', def[3]); }
    gs.print('   • "' + nom + '"' + (cambios.length ? ': ' + cambios.join(' | ') : ': sin cambio'));
    if (cambios.length && !DRY_RUN) p.update();
    if (def[1].indexOf('Mostrar') != 0) continue;
    var a = new GlideRecord('catalog_ui_policy_action'); a.addQuery('ui_policy', p.getUniqueValue()); a.query();
    while (a.next()) {
        var an = NOMBRE[a.getValue('catalog_variable')] || '?';
        if (FUERA.indexOf(an) > -1) { gs.print('     → ' + an + ': variable inactiva, la acción queda sin efecto'); continue; }
        var ch = [];
        if (a.getValue('visible') == 'true' && a.getValue('value_action') != 'clearValue') { ch.push('BORRAR VALOR'); a.setValue('value_action', 'clearValue'); }
        if (an == 'vigencia' && a.getValue('mandatory') != (VIGENCIA_OBLIGATORIA ? 'true' : 'false')) { ch.push('oblig → ' + VIGENCIA_OBLIGATORIA); a.setValue('mandatory', VIGENCIA_OBLIGATORIA ? 'true' : 'false'); }
        if (ch.length) { gs.print('     → ' + an + ' | ' + ch.join(' | ')); if (!DRY_RUN) a.update(); }
    }
}

// 4) onChange de Acción
gs.print('\n4) onChange de Acción');
var CODIGO =
    'function onChange(control, oldValue, newValue, isLoading) {\n' +
    '    // OCI_LIMPIAR_ACCION\n' +
    '    if (isLoading) return;\n' +
    "    var campos = ['" + P + "vigencia', '" + P + "caducidad_vigencia'];\n" +
    '    for (var i = 0; i < campos.length; i++) g_form.clearValue(campos[i]);\n' +
    '}';
var cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.addQuery('cat_variable', ID.accion_requerida); cs.addQuery('type', 'onChange'); cs.addActiveQuery(); cs.query();
if (!cs.next()) gs.print('   ⚠️ no encontré el onChange de Acción');
else if (cs.getValue('script') == CODIGO) gs.print('   • sin cambio');
else {
    gs.print('   • "' + cs.getValue('name') + '" → "onChange - Limpiar campos - Acción" | código nuevo:\n' + CODIGO);
    if (!DRY_RUN) { cs.setValue('name', 'onChange - Limpiar campos - Acción'); cs.setValue('script', CODIGO); cs.update(); }
}

// 5) Textos de opciones
gs.print('\n5) Opciones (lo que se ve en el portal)');
[['accion_requerida', ['eliminar_acceso', 'otorgar_modificar_acceso']], ['vigencia', ['definida', 'indefinida']]].forEach(function (x) {
    var v = varRec(x[0]); if (!v) return;
    var c = new GlideRecord('question_choice'); c.addQuery('question', v.getUniqueValue()); c.addQuery('value', 'IN', x[1].join(',')); c.query();
    while (c.next()) {
        var t = c.getValue('text');
        if (t.indexOf(ZW) > -1) { gs.print('   • ' + x[0] + '.' + c.getValue('value') + ': ya tiene \\u200B'); continue; }
        var es = trEs(t);
        if (!es || es == t) { gs.print('   • ' + x[0] + '.' + c.getValue('value') + ' "' + t + '": se ve bien'); continue; }
        gs.print('   • ' + x[0] + '.' + c.getValue('value') + ' "' + t + '" (se veía "' + es + '") → "' + t + '\\u200B"');
        if (!DRY_RUN) { c.setValue('text', t + ZW); c.update(); }
    }
});

// 6) Orden
gs.print('\n6) Orden');
ORDEN.forEach(function (n, i) {
    var ord = (i + 1) * 100, v = varRec(n);
    if (!v) { gs.print('   ⚠️ no existe ' + P + n); return; }
    if (v.getValue('order') == String(ord)) return;
    gs.print('   • ' + n + ': ' + v.getValue('order') + ' → ' + ord);
    if (!DRY_RUN) { v.setValue('order', ord); v.update(); }
});
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
