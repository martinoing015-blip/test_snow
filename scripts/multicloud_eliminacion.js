/*
 * Solicitud Masiva Entorno Multicloud — Eliminación como Remedy
 *   Eliminación + Azure / AWS / OCI → ¿Posee cuenta T1? (Si → Indique cuenta T1) + Indique rol a eliminar
 *   Eliminación + GCP               → Indique rol a eliminar
 *   Sin rol administrativo, sin Vigencia / Caducidad.
 *   NUEVA: u_sol_mas_ent_mcld_rol_eliminar (texto una línea)
 *
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 * Se puede correr más de una vez: lo que ya está bien no se toca.
 */
var DRY_RUN = true;
var ITEM_ID = '31c840631be3325058f65425604bcb53';
var P = 'u_sol_mas_ent_mcld_';
var ELIM_NAME = P + 'rol_eliminar';
var ELIM_TEXT = 'Indique rol a eliminar';
var ELIM_POL = 'Mostrar - Indique rol a eliminar';

gs.print('DRY_RUN = ' + DRY_RUN);
function varRec(name) {
    var v = new GlideRecord('item_option_new');
    v.addQuery('cat_item', ITEM_ID); v.addQuery('name', name); v.query();
    return v.next() ? v : null;
}
function polRec(name) {
    var p = new GlideRecord('catalog_ui_policy');
    p.addQuery('catalog_item', ITEM_ID); p.addQuery('short_description', name); p.query();
    return p.next() ? p : null;
}
function save(gr) { if (!DRY_RUN) gr.update(); }
function clonar(table, sysId, campos) {   // copia un registro existente cambiando algunos campos
    var g = new GlideRecord(table); g.get(sysId);
    for (var f in campos) g.setValue(f, campos[f]);
    if (DRY_RUN) return '(nuevo)';
    g.setNewGuidValue(gs.generateGUID());
    return g.insert();
}
function IO(x) { return 'IO:' + (typeof x == 'string' ? x : x.getUniqueValue()); }

var ACC = varRec(P + 'accion_requerida'), AMB = varRec(P + 'ambiente_cloud'), ROL = varRec(P + 'requiere_rol_admin'),
    ROLG = varRec(P + 'requiere_rol_admin_gcp'), POSEE = varRec(P + 'posee_cuenta_t1'), CTA = varRec(P + 'cuenta_t1');
if (!ACC || !AMB || !ROL || !ROLG || !POSEE || !CTA) { gs.print('❌ Falta alguna variable base (accion/ambiente/rol/rol_gcp/posee/cuenta_t1)'); }
else {
    // 1) Variable nueva rol_eliminar (copia de cuenta_t1, sin su ayuda)
    gs.print('\n--- 1) VARIABLE ' + ELIM_NAME);
    var ev = varRec(ELIM_NAME), ELIM_ID;
    if (ev) { ELIM_ID = ev.getUniqueValue(); gs.print('• ya existe'); }
    else {
        gs.print('• crear "' + ELIM_TEXT + '" | ' + CTA.getDisplayValue('type') + ' (copia de cuenta_t1, sin ayuda ni default)');
        ELIM_ID = clonar('item_option_new', CTA.getUniqueValue(), {
            name: ELIM_NAME, question_text: ELIM_TEXT, order: 700, mandatory: false, active: true,
            help_text: '', show_help: false, show_help_on_load: false, tooltip: '', instructions: '', default_value: ''
        });
    }

    // 2) Orden de variables (100 en 100) y set al final
    gs.print('\n--- 2) ORDEN');
    var ORDEN = ['accion_requerida', 'ambiente_cloud', 'requiere_rol_admin', 'requiere_rol_admin_gcp', 'posee_cuenta_t1',
        'cuenta_t1', 'rol_eliminar', 'matriz_gcp', 'vigencia', 'caducidad_vigencia', 'cantidad_usuarios',
        'desc_solicitud', 'proyecto', 'nombre_proyecto'];
    ORDEN.forEach(function (n, i) {
        var v = varRec(P + n), ord = (i + 1) * 100;
        if (!v) { if (P + n != ELIM_NAME || !DRY_RUN) gs.print('❌ No existe ' + P + n); return; }
        if (v.getValue('order') != ord) { gs.print('• ' + P + n + ': ' + v.getValue('order') + ' → ' + ord); v.setValue('order', ord); save(v); }
    });
    var setOrd = (ORDEN.length + 1) * 100;
    var io = new GlideRecord('io_set_item'); io.addQuery('sc_cat_item', ITEM_ID); io.query();
    while (io.next()) if (io.getValue('order') != setOrd) {
        gs.print('• set "' + io.getDisplayValue('variable_set') + '" (io_set_item): ' + io.getValue('order') + ' → ' + setOrd);
        io.setValue('order', setOrd); save(io);
    }

    // 3) Policy nueva "Mostrar - Indique rol a eliminar" (copia de "Mostrar - Indique cuenta T1")
    gs.print('\n--- 3) POLICY ' + ELIM_POL);
    if (polRec(ELIM_POL)) gs.print('• ya existe');
    else {
        var src = polRec('Mostrar - Indique cuenta T1');
        if (!src) gs.print('❌ No existe "Mostrar - Indique cuenta T1" para copiar');
        else {
            gs.print('• crear → ' + ELIM_NAME + ' visible + obligatoria');
            var newPol = clonar('catalog_ui_policy', src.getUniqueValue(), { short_description: ELIM_POL, order: 600 });
            var sa = new GlideRecord('catalog_ui_policy_action');
            sa.addQuery('ui_policy', src.getUniqueValue()); sa.addQuery('catalog_variable', IO(CTA)); sa.query();
            if (sa.next()) clonar('catalog_ui_policy_action', sa.getUniqueValue(), { ui_policy: newPol, catalog_variable: IO(ELIM_ID), visible: 'true', mandatory: 'true' });
            else gs.print('❌ No se encontró la acción de cuenta_t1 para copiar');
        }
    }

    // 4) Condiciones y orden de policies
    //    En los encoded query, ^OR se agrupa con el término anterior: (a OR b OR c) ^ (d OR e)
    gs.print('\n--- 4) POLICIES');
    var ELIM = IO(ACC) + '=eliminar_acceso';
    var NO_GCP = IO(AMB) + '=microsoft_azure^OR' + IO(AMB) + '=amazon_web_service^OR' + IO(AMB) + '=oracle_cloud_infrastructure';
    // Posee T1: (rol=si OR rol_gcp=consola OR accion=eliminacion) ^ (ambiente Azure/AWS/OCI OR rol_gcp=consola)
    // (rol y rol_gcp solo tienen valor en Creación/Modificación: se limpian al cambiar Acción)
    var POSEE_C = IO(ROL) + '=si^OR' + IO(ROLG) + '=consola_administracion^OR' + ELIM + '^' + NO_GCP + '^OR' + IO(ROLG) + '=consola_administracion^';
    var POL = [
        { n: 'Mostrar - Seleccione ambiente Cloud', o: 100,
          c: IO(ACC) + '=otorgar_modificar_acceso^OR' + IO(ACC) + '=modificacion^OR' + ELIM + '^EQ', t: 'accion=Creación/Modificación/Eliminación' },
        { n: 'Mostrar - ¿Requiere rol administrativo?', o: 200 },
        { n: 'Mostrar - ¿Requiere rol administrativo? (GCP)', o: 300 },
        { n: 'Mostrar - ¿Posee cuenta T1?', o: 400, c: POSEE_C + 'EQ',
          t: '(rol=si OR rol_gcp=consola OR accion=Eliminación) ^ (ambiente=Azure/AWS/OCI OR rol_gcp=consola)' },
        { n: 'Mostrar - Indique cuenta T1', o: 500, c: POSEE_C + IO(POSEE) + '=si^EQ',
          t: '(rol=si OR rol_gcp=consola OR accion=Eliminación) ^ (ambiente=Azure/AWS/OCI OR rol_gcp=consola) ^ posee=si' },
        { n: ELIM_POL, o: 600, c: ELIM + '^' + NO_GCP + '^OR' + IO(AMB) + '=google_cloud_platform^EQ', t: 'accion=Eliminación ^ ambiente elegido' },
        { n: 'Mostrar - Indique nombre de matriz GCP', o: 700 },
        { n: 'Mostrar - Vigencia', o: 800 },
        { n: 'Mostrar - Caducidad Vigencia', o: 900 },
        { n: 'Mostrar - Indicar nombre del proyecto', o: 1000 },
        { n: 'Obligatorio - ¿Esta solicitud está asociada a una célula?', o: 1100 },
        { n: 'Solo lectura', o: 1200 }
    ];
    POL.forEach(function (d) {
        var p = polRec(d.n);
        if (!p) { if (d.n != ELIM_POL || !DRY_RUN) gs.print('❌ No existe policy "' + d.n + '"'); return; }
        var cambios = [];
        if (p.getValue('order') != d.o) { cambios.push('orden ' + p.getValue('order') + ' → ' + d.o); p.setValue('order', d.o); }
        if (d.c && p.getValue('catalog_conditions') != d.c) { cambios.push('cond: ' + d.t); p.setValue('catalog_conditions', d.c); }
        if (cambios.length) { gs.print('• "' + d.n + '": ' + cambios.join(' | ')); save(p); }
    });

    // 5) Solo lectura: + rol_eliminar
    gs.print('\n--- 5) SOLO LECTURA');
    var solo = polRec('Solo lectura');
    if (!solo) gs.print('❌ No existe "Solo lectura"');
    else {
        var s = new GlideRecord('catalog_ui_policy_action');
        s.addQuery('ui_policy', solo.getUniqueValue()); s.addQuery('catalog_variable', IO(ELIM_ID)); s.query();
        if (s.next()) gs.print('• ya está ' + ELIM_NAME);
        else {
            var base = new GlideRecord('catalog_ui_policy_action');
            base.addQuery('ui_policy', solo.getUniqueValue()); base.addQuery('catalog_variable', IO(CTA)); base.query();
            if (base.next()) { gs.print('• agregar ' + ELIM_NAME); clonar('catalog_ui_policy_action', base.getUniqueValue(), { catalog_variable: IO(ELIM_ID) }); }
            else gs.print('❌ cuenta_t1 no está en Solo lectura (no se puede copiar)');
        }
    }

    // 6) Client scripts de limpieza: Acción y Ambiente también limpian rol_eliminar
    gs.print('\n--- 6) CLIENT SCRIPTS');
    var CAMPOS = {
        'SMMC_LIMPIAR_ACCION': ['ambiente_cloud', 'requiere_rol_admin', 'requiere_rol_admin_gcp', 'posee_cuenta_t1', 'cuenta_t1', 'rol_eliminar', 'matriz_gcp', 'vigencia', 'caducidad_vigencia'],
        'SMMC_LIMPIAR_AMB': ['requiere_rol_admin', 'requiere_rol_admin_gcp', 'posee_cuenta_t1', 'cuenta_t1', 'rol_eliminar', 'matriz_gcp']
    };
    var cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.query();
    while (cs.next()) {
        var code = cs.getValue('script') || '', mk = '';
        for (var k in CAMPOS) if (code.indexOf('// ' + k + '\n') > -1 || code.indexOf('// ' + k + '\r') > -1) mk = k;
        if (!mk) continue;
        var nuevo = 'var campos = ' + JSON.stringify(CAMPOS[mk].map(function (x) { return P + x; })) + ';';
        var mt = code.match(/var campos = \[[^\]]*\];/);
        if (!mt) { gs.print('❌ ' + mk + ': no se encontró "var campos"'); continue; }
        if (mt[0] == nuevo) { gs.print('• ' + mk + ': OK'); continue; }
        gs.print('• ' + mk + ' (' + cs.getValue('name') + '): campos = ' + CAMPOS[mk].join(', '));
        cs.setValue('script', code.replace(mt[0], nuevo)); save(cs);
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
