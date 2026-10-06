/*
 * Solicitud Masiva Entorno Multicloud — values de "Acción Requerida" con el patrón _acceso
 *   Creación      otorgar_modificar_acceso → crear_acceso      (NUEVA opción)
 *   Modificación  modificacion             → modificar_acceso  (NUEVA opción)
 *   Eliminación   eliminar_acceso          (sin cambio)
 *   Las opciones antiguas NO se borran ni cambian su value: se inactivan y su texto
 *   pasa a "Creación (anterior)" / "Modificación (anterior)" para distinguirlas en Flow Designer.
 *   Las policies aceptan el value nuevo y el antiguo (RITM antiguos siguen funcionando).
 *
 *   ⚠️ DESPUÉS hay que ajustar el Flow (Flujo I) a mano: ver instrucciones en el chat.
 *
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 * Se puede correr más de una vez: lo que ya está bien no se toca.
 */
var DRY_RUN = true;
var ITEM_ID = '31c840631be3325058f65425604bcb53';
var P = 'u_sol_mas_ent_mcld_';
var CAMBIOS = [
    { viejo: 'otorgar_modificar_acceso', nuevo: 'crear_acceso', texto: 'Creación', order: 100 },
    { viejo: 'modificacion', nuevo: 'modificar_acceso', texto: 'Modificación', order: 200 }
];
var ELIM = { value: 'eliminar_acceso', order: 300 };

gs.print('DRY_RUN = ' + DRY_RUN);
var acc = new GlideRecord('item_option_new');
acc.addQuery('cat_item', ITEM_ID); acc.addQuery('name', P + 'accion_requerida'); acc.query();
if (!acc.next()) gs.print('❌ No existe ' + P + 'accion_requerida');
else {
    var ACC_ID = acc.getUniqueValue(), IO = 'IO:' + ACC_ID;
    function choice(value) {
        var c = new GlideRecord('question_choice');
        c.addQuery('question', ACC_ID); c.addQuery('value', value); c.query();
        return c.next() ? c : null;
    }

    // 1) Opciones
    gs.print('\n--- 1) OPCIONES de accion_requerida');
    CAMBIOS.forEach(function (x) {
        var n = choice(x.nuevo);
        if (n) gs.print('• ya existe ' + x.nuevo + ' = "' + n.getValue('text') + '"');
        else {
            gs.print('• crear ' + x.nuevo + ' = "' + x.texto + '" (orden ' + x.order + ')');
            if (!DRY_RUN) {
                var c = new GlideRecord('question_choice'); c.initialize();
                c.setValue('question', ACC_ID); c.setValue('value', x.nuevo); c.setValue('text', x.texto); c.setValue('order', x.order); c.insert();
            }
        }
        var o = choice(x.viejo);
        if (!o) { gs.print('  (no existe ' + x.viejo + ')'); return; }
        var t = x.texto + ' (anterior)';
        if (o.getValue('inactive') != '1' || o.getValue('text') != t) {
            gs.print('• ' + x.viejo + ': inactivar, texto "' + o.getValue('text') + '" → "' + t + '" (value sin cambio)');
            o.setValue('inactive', true); o.setValue('text', t); if (!DRY_RUN) o.update();
        }
    });
    var e = choice(ELIM.value);
    if (!e) gs.print('❌ No existe ' + ELIM.value);
    else if (e.getValue('order') != ELIM.order) {
        gs.print('• ' + ELIM.value + ': orden ' + e.getValue('order') + ' → ' + ELIM.order);
        e.setValue('order', ELIM.order); if (!DRY_RUN) e.update();
    }

    // 2) Policies: value antiguo → value nuevo O antiguo
    //    "X" se reemplaza por "X_nuevo^ORX": dentro de un encoded query queda en el mismo grupo OR
    gs.print('\n--- 2) POLICIES');
    var p = new GlideRecord('catalog_ui_policy');
    p.addQuery('catalog_item', ITEM_ID); p.addQuery('active', true); p.orderBy('order'); p.query();
    while (p.next()) {
        var cond = p.getValue('catalog_conditions') || '', orig = cond, nota = [];
        CAMBIOS.forEach(function (x) {
            var viejo = IO + '=' + x.viejo + '^', nuevo = IO + '=' + x.nuevo + '^OR' + IO + '=' + x.viejo + '^';
            if (cond.indexOf(viejo) > -1 && cond.indexOf(IO + '=' + x.nuevo + '^') == -1) {
                cond = cond.split(viejo).join(nuevo); nota.push(x.texto + ': ' + x.viejo + ' → ' + x.nuevo + ' (o ' + x.viejo + ')');
            }
        });
        if (cond != orig) {
            gs.print('• "' + p.getValue('short_description') + '": ' + nota.join(' | '));
            p.setValue('catalog_conditions', cond); if (!DRY_RUN) p.update();
        }
    }

    // 3) Client scripts del ítem que mencionen los values antiguos (solo aviso)
    gs.print('\n--- 3) CLIENT SCRIPTS (solo revisión)');
    var hay = false;
    var cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.addQuery('active', true); cs.query();
    while (cs.next()) {
        var code = cs.getValue('script') || '';
        CAMBIOS.forEach(function (x) {
            if (code.indexOf("'" + x.viejo + "'") > -1 || code.indexOf('"' + x.viejo + '"') > -1) {
                gs.print('⚠️ "' + cs.getValue('name') + '" usa ' + x.viejo + ' (revisar)'); hay = true;
            }
        });
    }
    if (!hay) gs.print('• ninguno usa los values antiguos');
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
