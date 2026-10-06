/*
 * Solicitud Masiva Entorno Multicloud — "¿Requiere rol administrativo?" distinto solo en GCP (como Remedy)
 *   Azure / AWS / OCI → u_sol_mas_ent_mcld_requiere_rol_admin      (Si / No)
 *   GCP               → u_sol_mas_ent_mcld_requiere_rol_admin_gcp  (Consola Administración / Dominio de datos) NUEVA
 *   Si  o  Consola Administración → ¿Posee cuenta T1? → (Si) Indique cuenta T1
 *   Dominio de datos (GCP)        → Indique nombre de matriz GCP
 *   matriz_azure / aws / oci vuelven a inactivas (Remedy no las pide)
 *
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 * Se puede correr más de una vez: lo que ya está bien no se toca.
 */
var DRY_RUN = true;
var ITEM_ID = '31c840631be3325058f65425604bcb53';
var P = 'u_sol_mas_ent_mcld_';
var ROLG_NAME = P + 'requiere_rol_admin_gcp';
var MATRIZ_OFF = [P + 'matriz_azure', P + 'matriz_aws', P + 'matriz_oci'];

gs.print('DRY_RUN = ' + DRY_RUN);
function varRec(name) {
    var v = new GlideRecord('item_option_new');
    v.addQuery('cat_item', ITEM_ID); v.addQuery('name', name); v.query();
    return v.next() ? v : null;
}
function save(gr) { if (!DRY_RUN) gr.update(); }
function clonar(table, sysId, campos) {   // copia un registro existente cambiando algunos campos
    var g = new GlideRecord(table); g.get(sysId);
    for (var f in campos) g.setValue(f, campos[f]);
    if (DRY_RUN) return '(nuevo)';
    g.setNewGuidValue(gs.generateGUID());
    return g.insert();
}
function polRec(name) {
    var p = new GlideRecord('catalog_ui_policy');
    p.addQuery('catalog_item', ITEM_ID); p.addQuery('short_description', name); p.query();
    return p.next() ? p : null;
}

var ACC = varRec(P + 'accion_requerida'), AMB = varRec(P + 'ambiente_cloud'), ROL = varRec(P + 'requiere_rol_admin'),
    POSEE = varRec(P + 'posee_cuenta_t1'), MGCP = varRec(P + 'matriz_gcp');
if (!ACC || !AMB || !ROL || !POSEE || !MGCP) { gs.print('❌ Falta alguna variable base (accion/ambiente/rol/posee/matriz_gcp)'); }
else {
    var ROL_ID = ROL.getUniqueValue();

    // 1) Variable nueva requiere_rol_admin_gcp (copia de requiere_rol_admin)
    gs.print('\n--- 1) VARIABLE ' + ROLG_NAME);
    var rolg = varRec(ROLG_NAME), ROLG_ID;
    if (rolg) { ROLG_ID = rolg.getUniqueValue(); gs.print('• ya existe'); }
    else {
        gs.print('• crear (copia de requiere_rol_admin, mismo texto "' + ROL.getValue('question_text') + '")');
        ROLG_ID = clonar('item_option_new', ROL_ID, { name: ROLG_NAME, order: 400 });
        var tq = new GlideRecord('sys_translated_text');
        tq.addQuery('tablename', 'item_option_new'); tq.addQuery('documentkey', ROL_ID); tq.addQuery('language', 'es'); tq.query();
        while (tq.next()) {
            gs.print('  + copiar traducción es de ' + tq.getValue('fieldname'));
            clonar('sys_translated_text', tq.getUniqueValue(), { documentkey: ROLG_ID });
        }
    }

    // 2) Opciones: si/no activas en rol; consola/dominio se mueven a rol_gcp
    gs.print('\n--- 2) OPCIONES');
    var c = new GlideRecord('question_choice'); c.addQuery('question', ROL_ID); c.query();
    while (c.next()) {
        var val = c.getValue('value');
        if ((val == 'si' || val == 'no') && c.getValue('inactive') == '1') {
            gs.print('• requiere_rol_admin: reactivar ' + val); c.setValue('inactive', false); save(c);
        } else if (val == 'consola_administracion' || val == 'dominio_datos') {
            gs.print('• mover ' + val + ' = "' + c.getValue('text') + '" a ' + ROLG_NAME);
            c.setValue('question', ROLG_ID); c.setValue('inactive', false); save(c);
        }
    }
    if (rolg) {   // si la variable ya existía, confirmar que tenga sus dos opciones
        [['consola_administracion', 'Consola Administración', 100], ['dominio_datos', 'Dominio de datos', 200]].forEach(function (o) {
            var q = new GlideRecord('question_choice'); q.addQuery('question', ROLG_ID); q.addQuery('value', o[0]); q.query();
            if (!q.next()) {
                gs.print('• ' + ROLG_NAME + ': crear ' + o[0]);
                if (!DRY_RUN) { q.initialize(); q.setValue('question', ROLG_ID); q.setValue('value', o[0]); q.setValue('text', o[1]); q.setValue('order', o[2]); q.insert(); }
            }
        });
    }

    // 3) Variables: matrices Azure/AWS/OCI inactivas; orden de 100 en 100
    gs.print('\n--- 3) VARIABLES Y ORDEN');
    MATRIZ_OFF.forEach(function (n, i) {
        var v = varRec(n); if (!v) return;
        if (v.getValue('active') == '1') { gs.print('• inactivar ' + n); v.setValue('active', false); }
        v.setValue('order', 9100 + i * 100); save(v);
    });
    var ORDEN = ['accion_requerida', 'ambiente_cloud', 'requiere_rol_admin', 'requiere_rol_admin_gcp', 'posee_cuenta_t1',
        'cuenta_t1', 'matriz_gcp', 'vigencia', 'caducidad_vigencia', 'cantidad_usuarios', 'desc_solicitud',
        'proyecto', 'nombre_proyecto'];
    ORDEN.forEach(function (n, i) {
        var v = varRec(P + n), ord = (i + 1) * 100;
        if (!v) { if (P + n != ROLG_NAME || !DRY_RUN) gs.print('❌ No existe ' + P + n); return; }
        if (v.getValue('order') != ord) { gs.print('• ' + P + n + ': ' + v.getValue('order') + ' → ' + ord); v.setValue('order', ord); save(v); }
    });
    var setOrd = (ORDEN.length + 1) * 100;
    var io = new GlideRecord('io_set_item'); io.addQuery('sc_cat_item', ITEM_ID); io.query();
    while (io.next()) if (io.getValue('order') != setOrd) {
        gs.print('• set "' + io.getDisplayValue('variable_set') + '" (io_set_item): ' + io.getValue('order') + ' → ' + setOrd);
        io.setValue('order', setOrd); save(io);
    }

    // 4) Policies
    gs.print('\n--- 4) POLICIES');
    var IO = function (gr) { return 'IO:' + (typeof gr == 'string' ? gr : gr.getUniqueValue()); };
    var CREA = IO(ACC) + '=otorgar_modificar_acceso^';
    var ROL_SI = IO(ROL) + '=si^OR' + IO(ROLG_ID) + '=consola_administracion^';
    var GCP_NAME = 'Mostrar - ¿Requiere rol administrativo? (GCP)';
    if (!polRec(GCP_NAME)) {
        var src = polRec('Mostrar - ¿Requiere rol administrativo?');
        if (!src) gs.print('❌ No existe "Mostrar - ¿Requiere rol administrativo?"');
        else {
            gs.print('• crear "' + GCP_NAME + '" → ' + ROLG_NAME + ' visible + obligatoria');
            var newPol = clonar('catalog_ui_policy', src.getUniqueValue(), { short_description: GCP_NAME, order: 300 });
            var sa = new GlideRecord('catalog_ui_policy_action');
            sa.addQuery('ui_policy', src.getUniqueValue()); sa.addQuery('catalog_variable', IO(ROL)); sa.query();
            if (sa.next()) clonar('catalog_ui_policy_action', sa.getUniqueValue(), { ui_policy: newPol, catalog_variable: IO(ROLG_ID) });
            else gs.print('❌ No se encontró la acción de requiere_rol_admin para copiar');
        }
    }
    var POL = [
        { n: 'Mostrar - Seleccione ambiente Cloud', o: 100 },
        { n: 'Mostrar - ¿Requiere rol administrativo?', o: 200, c: CREA + IO(AMB) + '=microsoft_azure^OR' + IO(AMB) + '=amazon_web_service^OR' + IO(AMB) + '=oracle_cloud_infrastructure^EQ', t: 'accion=Creación ^ ambiente=Azure/AWS/OCI' },
        { n: GCP_NAME, o: 300, c: CREA + IO(AMB) + '=google_cloud_platform^EQ', t: 'accion=Creación ^ ambiente=GCP' },
        { n: 'Mostrar - ¿Posee cuenta T1?', o: 400, c: CREA + ROL_SI + 'EQ', t: 'accion=Creación ^ (rol=si OR rol_gcp=consola_administracion)' },
        { n: 'Mostrar - Indique cuenta T1', o: 500, c: CREA + ROL_SI + IO(POSEE) + '=si^EQ', t: 'accion=Creación ^ (rol=si OR rol_gcp=consola_administracion) ^ posee=si' },
        { n: 'Mostrar - Indique nombre de matriz GCP', o: 600, c: CREA + IO(AMB) + '=google_cloud_platform^' + IO(ROLG_ID) + '=dominio_datos^EQ', t: 'accion=Creación ^ ambiente=GCP ^ rol_gcp=dominio_datos' },
        { n: 'Mostrar - Vigencia', o: 700 },
        { n: 'Mostrar - Caducidad Vigencia', o: 800 },
        { n: 'Mostrar - Indicar nombre del proyecto', o: 900 },
        { n: 'Obligatorio - ¿Esta solicitud está asociada a una célula?', o: 1000 },
        { n: 'Solo lectura', o: 1100 },
        { n: 'Mostrar - Indique nombre de matriz de Azure', o: 9100, off: true },
        { n: 'Mostrar - Indique nombre de matriz de AWS', o: 9200, off: true },
        { n: 'Mostrar - Indique nombre de matriz de OCI', o: 9300, off: true }
    ];
    POL.forEach(function (d) {
        var p = polRec(d.n);
        if (!p) { if (d.n != GCP_NAME || !DRY_RUN) gs.print('❌ No existe policy "' + d.n + '"'); return; }
        var cambios = [];
        if (p.getValue('order') != d.o) { cambios.push('orden ' + p.getValue('order') + ' → ' + d.o); p.setValue('order', d.o); }
        if (d.c && p.getValue('catalog_conditions') != d.c) { cambios.push('cond: ' + d.t); p.setValue('catalog_conditions', d.c); }
        if (d.off && p.getValue('active') == '1') { cambios.push('inactivar'); p.setValue('active', false); }
        if (cambios.length) { gs.print('• "' + d.n + '": ' + cambios.join(' | ')); save(p); }
    });

    // 5) Solo lectura: + rol_gcp; − matrices inactivas
    gs.print('\n--- 5) SOLO LECTURA');
    var solo = polRec('Solo lectura');
    if (!solo) gs.print('❌ No existe "Solo lectura"');
    else {
        var s = new GlideRecord('catalog_ui_policy_action');
        s.addQuery('ui_policy', solo.getUniqueValue()); s.addQuery('catalog_variable', IO(ROLG_ID)); s.query();
        if (!s.next()) {
            gs.print('• agregar ' + ROLG_NAME);
            var base = new GlideRecord('catalog_ui_policy_action');
            base.addQuery('ui_policy', solo.getUniqueValue()); base.addQuery('catalog_variable', IO(ROL)); base.query();
            if (base.next()) clonar('catalog_ui_policy_action', base.getUniqueValue(), { catalog_variable: IO(ROLG_ID) });
            else gs.print('❌ requiere_rol_admin no está en Solo lectura (no se puede copiar)');
        }
        MATRIZ_OFF.forEach(function (n) {
            var v = varRec(n); if (!v) return;
            var r = new GlideRecord('catalog_ui_policy_action');
            r.addQuery('ui_policy', solo.getUniqueValue()); r.addQuery('catalog_variable', IO(v)); r.query();
            while (r.next()) { gs.print('• quitar ' + n); if (!DRY_RUN) r.deleteRecord(); }
        });
    }

    // 6) Client scripts de limpieza (lista exacta de campos por marcador)
    gs.print('\n--- 6) CLIENT SCRIPTS');
    var CAMPOS = {
        'SMMC_LIMPIAR_ACCION': ['ambiente_cloud', 'requiere_rol_admin', 'requiere_rol_admin_gcp', 'posee_cuenta_t1', 'cuenta_t1', 'matriz_gcp', 'vigencia', 'caducidad_vigencia'],
        'SMMC_LIMPIAR_AMB': ['requiere_rol_admin', 'requiere_rol_admin_gcp', 'posee_cuenta_t1', 'cuenta_t1', 'matriz_gcp'],
        'SMMC_LIMPIAR_ROL': ['posee_cuenta_t1', 'cuenta_t1'],
        'SMMC_LIMPIAR_ROL_GCP': ['posee_cuenta_t1', 'cuenta_t1', 'matriz_gcp']
    };
    function marcador(code) {
        for (var k in CAMPOS) if (code.indexOf('// ' + k + '\n') > -1 || code.indexOf('// ' + k + '\r') > -1) return k;
        return '';
    }
    var hay = {}, rolScriptId = '';
    var cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.query();
    while (cs.next()) {
        var code = cs.getValue('script') || '', mk = marcador(code);
        if (!mk) continue;
        hay[mk] = true;
        if (mk == 'SMMC_LIMPIAR_ROL') rolScriptId = cs.getUniqueValue();
        var lista = CAMPOS[mk].map(function (x) { return P + x; });
        var nuevo = 'var campos = ' + JSON.stringify(lista) + ';';
        var mt = code.match(/var campos = \[[^\]]*\];/);
        if (!mt) { gs.print('❌ ' + mk + ': no se encontró "var campos"'); continue; }
        if (mt[0] == nuevo) { gs.print('• ' + mk + ': OK'); continue; }
        gs.print('• ' + mk + ' (' + cs.getValue('name') + '): campos = ' + CAMPOS[mk].join(', '));
        cs.setValue('script', code.replace(mt[0], nuevo)); save(cs);
    }
    if (!hay['SMMC_LIMPIAR_ROL_GCP']) {
        if (!rolScriptId) gs.print('❌ No existe SMMC_LIMPIAR_ROL para copiar');
        else {
            gs.print('• crear "onChange - Limpiar campos - Rol admin GCP" (SMMC_LIMPIAR_ROL_GCP) sobre ' + ROLG_NAME);
            var code2 = 'function onChange(control, oldValue, newValue, isLoading) {\n' +
                '    // SMMC_LIMPIAR_ROL_GCP\n' +
                '    if (isLoading) return;\n' +
                '    var campos = ' + JSON.stringify(CAMPOS['SMMC_LIMPIAR_ROL_GCP'].map(function (x) { return P + x; })) + ';\n' +
                '    for (var i = 0; i < campos.length; i++) g_form.clearValue(campos[i]);\n' +
                '}';
            clonar('catalog_script_client', rolScriptId, { name: 'onChange - Limpiar campos - Rol admin GCP', cat_variable: IO(ROLG_ID), script: code2 });
        }
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
