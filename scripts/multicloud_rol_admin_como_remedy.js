/*
 * Solicitud Masiva Entorno Multicloud — "¿Requiere rol administrativo?" como Remedy
 *   Si / No  →  Consola Administración / Dominio de datos
 *   Consola Administración → ¿Posee cuenta T1? (igual que antes con Si)
 *   Dominio de datos       → Indique nombre de matriz (según ambiente; reactiva matriz_*)
 *
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 *
 * No toca el set "Conjunto de celulas 2" (solo su io_set_item.order del ítem).
 * Las opciones si/no se INACTIVAN (no se borran ni cambian su value): los RITM
 * antiguos las siguen mostrando y las policies aceptan también rol=si.
 */
var DRY_RUN = true;
var FLOW_REVISADO = false;   // poner true solo si el Flow usa requiere_rol_admin y ya se revisó
var CAMBIAR_LINK_T2 = true;  // descripción: "Alto Privilegio T1" → "Alto Privilegio T1, T2" (como Remedy)
var ITEM_ID = '31c840631be3325058f65425604bcb53';
var P = 'u_sol_mas_ent_mcld_';

var NUEVAS = [
    { value: 'consola_administracion', text: 'Consola Administración', order: 100 },
    { value: 'dominio_datos', text: 'Dominio de datos', order: 200 }
];
var MATRICES = [
    { cloud: 'microsoft_azure', name: P + 'matriz_azure', policy: 'Mostrar - Indique nombre de matriz de Azure', order: 500 },
    { cloud: 'amazon_web_service', name: P + 'matriz_aws', policy: 'Mostrar - Indique nombre de matriz de AWS', order: 600 },
    { cloud: 'oracle_cloud_infrastructure', name: P + 'matriz_oci', policy: 'Mostrar - Indique nombre de matriz de OCI', order: 700 },
    { cloud: 'google_cloud_platform', name: P + 'matriz_gcp', policy: 'Mostrar - Indique nombre de matriz GCP', order: 800,
      texto: 'Indique nombre de matriz GCP' }   // texto como Remedy (los otros 3: pendiente captura)
];
var ORDEN_VARS = ['accion_requerida', 'ambiente_cloud', 'requiere_rol_admin', 'posee_cuenta_t1', 'cuenta_t1',
    'matriz_azure', 'matriz_aws', 'matriz_oci', 'matriz_gcp', 'vigencia', 'caducidad_vigencia',
    'cantidad_usuarios', 'desc_solicitud', 'proyecto', 'nombre_proyecto'];   // 100, 200, ...; set → 1600
var ORDEN_POL = {
    'Mostrar - Seleccione ambiente Cloud': 100,
    'Mostrar - ¿Requiere rol administrativo?': 200,
    'Mostrar - ¿Posee cuenta T1?': 300,
    'Mostrar - Indique cuenta T1': 400,
    'Mostrar - Vigencia': 900,
    'Mostrar - Caducidad Vigencia': 1000,
    'Mostrar - Indicar nombre del proyecto': 1100,
    'Obligatorio - ¿Esta solicitud está asociada a una célula?': 1200,
    'Solo lectura': 1300
};
var RENOMBRAR_POL = { 'Mostrar -  Obligatoriedad Seleccione Célula': 'Obligatorio - ¿Esta solicitud está asociada a una célula?' };
var LIMPIAR = { 'SMMC_LIMPIAR_ACCION': true, 'SMMC_LIMPIAR_AMB': true, 'SMMC_LIMPIAR_ROL': true };

gs.print('DRY_RUN = ' + DRY_RUN);
function varRec(name) {
    var v = new GlideRecord('item_option_new');
    v.addQuery('cat_item', ITEM_ID); v.addQuery('name', name); v.query();
    return v.next() ? v : null;
}
function save(gr) { if (!DRY_RUN) gr.update(); }

var rol = varRec(P + 'requiere_rol_admin');
if (!rol) { gs.print('❌ No existe ' + P + 'requiere_rol_admin'); }
else {
    var ROL_ID = rol.getUniqueValue();

    // 0) ¿El Flow usa estas variables?
    gs.print('\n--- 0) FLOW');
    var it = new GlideRecord('sc_cat_item'); it.get(ITEM_ID);
    var flowId = it.getValue('flow_designer_flow');
    var usaRol = false, usaMatriz = false;
    ['sys_hub_action_instance_v2', 'sys_hub_flow_logic_instance_v2'].forEach(function (t) {
        var a = new GlideRecord(t); a.addQuery('flow', flowId); a.query();
        while (a.next()) {
            var txt = '';
            try { txt = GlideCompressionUtil.expandToString(GlideStringUtil.base64DecodeAsBytes(a.getValue('values'))); } catch (e) { txt = a.getValue('values') || ''; }
            if (txt.indexOf('requiere_rol_admin') > -1 || txt.indexOf(ROL_ID) > -1) usaRol = true;
            if (txt.indexOf('matriz_') > -1) usaMatriz = true;
        }
    });
    gs.print('Flow ' + it.getDisplayValue('flow_designer_flow') + ' | usa requiere_rol_admin: ' + usaRol + ' | usa matriz_*: ' + usaMatriz);
    var bloquear = usaRol && !FLOW_REVISADO;
    if (bloquear) gs.print('⚠️ El Flow usa requiere_rol_admin: NO se cambian opciones ni condiciones. Revisar el Flow y poner FLOW_REVISADO=true.');

    // 1) Opciones
    gs.print('\n--- 1) OPCIONES de requiere_rol_admin');
    if (!bloquear) {
        NUEVAS.forEach(function (o) {
            var c = new GlideRecord('question_choice');
            c.addQuery('question', ROL_ID); c.addQuery('value', o.value); c.query();
            if (c.next()) { gs.print('• ya existe ' + o.value); return; }
            gs.print('• crear ' + o.value + ' = "' + o.text + '" (orden ' + o.order + ')');
            if (!DRY_RUN) { c.initialize(); c.setValue('question', ROL_ID); c.setValue('value', o.value); c.setValue('text', o.text); c.setValue('order', o.order); c.insert(); }
        });
        var old = new GlideRecord('question_choice');
        old.addQuery('question', ROL_ID); old.addQuery('value', 'IN', 'si,no'); old.addQuery('inactive', false); old.query();
        while (old.next()) { gs.print('• inactivar ' + old.getValue('value') + ' = "' + old.getValue('text') + '"'); old.setValue('inactive', true); save(old); }
    }

    // 2) Policies existentes: rol=si → rol=consola_administracion (o si, por RITM antiguos)
    gs.print('\n--- 2) POLICIES');
    var oldCond = 'IO:' + ROL_ID + '=si^', newCond = 'IO:' + ROL_ID + '=consola_administracion^ORIO:' + ROL_ID + '=si^';
    var p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID); p.query();
    var SOLO_ID = '';
    while (p.next()) {
        var nombre = p.getValue('short_description'), cambio = false;
        if (RENOMBRAR_POL[nombre]) { gs.print('• renombrar "' + nombre + '" → "' + RENOMBRAR_POL[nombre] + '"'); nombre = RENOMBRAR_POL[nombre]; p.setValue('short_description', nombre); cambio = true; }
        if (nombre == 'Solo lectura') SOLO_ID = p.getUniqueValue();
        var cond = p.getValue('catalog_conditions') || '';
        if (!bloquear && cond.indexOf(oldCond) > -1 && cond.indexOf(newCond) == -1) {
            gs.print('• "' + nombre + '": condición rol=si → rol=consola_administracion (o si)');
            p.setValue('catalog_conditions', cond.split(oldCond).join(newCond)); cambio = true;
        }
        if (ORDEN_POL[nombre] && p.getValue('order') != ORDEN_POL[nombre]) {
            gs.print('• "' + nombre + '": orden ' + p.getValue('order') + ' → ' + ORDEN_POL[nombre]);
            p.setValue('order', ORDEN_POL[nombre]); cambio = true;
        }
        if (cambio) save(p);
    }

    // 3) Matrices: reactivar variable, texto, policy con condición correcta, Solo lectura
    gs.print('\n--- 3) MATRICES');
    var AMB = varRec(P + 'ambiente_cloud'), ACC = varRec(P + 'accion_requerida');
    MATRICES.forEach(function (m) {
        var v = varRec(m.name);
        if (!v) { gs.print('❌ No existe ' + m.name); return; }
        var id = v.getUniqueValue();
        if (v.getValue('active') != '1') { gs.print('• reactivar ' + m.name); v.setValue('active', true); save(v); }
        if (m.texto && v.getValue('question_text') != m.texto) {
            gs.print('• ' + m.name + ': texto "' + v.getValue('question_text') + '" → "' + m.texto + '"');
            v.setValue('question_text', m.texto); save(v);
            var tt = new GlideRecord('sys_translated_text');
            tt.addQuery('tablename', 'item_option_new'); tt.addQuery('documentkey', id); tt.addQuery('fieldname', 'question_text'); tt.addQuery('language', 'es'); tt.query();
            if (tt.next()) { gs.print('  + traducción es'); tt.setValue('value', m.texto); save(tt); }
        }
        if (bloquear) return;
        var cond = 'IO:' + ACC.getUniqueValue() + '=otorgar_modificar_acceso^IO:' + AMB.getUniqueValue() + '=' + m.cloud +
            '^IO:' + ROL_ID + '=dominio_datos^EQ';
        // ui_policy apunta a sys_ui_policy: no se puede filtrar por ui_policy.catalog_item, se valida después
        var a = new GlideRecord('catalog_ui_policy_action'), pol = null;
        a.addQuery('catalog_variable', 'IO:' + id); a.query();
        while (a.next()) {
            var cand = new GlideRecord('catalog_ui_policy');
            if (cand.get(a.getValue('ui_policy')) && cand.getValue('catalog_item') == ITEM_ID &&
                cand.getValue('short_description') != 'Solo lectura') { pol = cand; break; }
        }
        if (!pol) { gs.print('❌ ' + m.name + ': no se encontró su policy (avisar, no se crea)'); }
        else {
            gs.print('• policy "' + pol.getValue('short_description') + '" → "' + m.policy + '" | activa | orden ' + m.order +
                ' | cond: accion=otorgar_modificar_acceso ^ ambiente=' + m.cloud + ' ^ rol=dominio_datos');
            pol.setValue('short_description', m.policy); pol.setValue('active', true); pol.setValue('order', m.order);
            pol.setValue('catalog_conditions', cond); save(pol);
            if (a.getValue('visible') != 'true' || a.getValue('mandatory') != 'true') {
                gs.print('  + acción: visible=true oblig=true'); a.setValue('visible', 'true'); a.setValue('mandatory', 'true'); save(a);
            }
        }
        if (SOLO_ID) {
            var s = new GlideRecord('catalog_ui_policy_action');
            s.addQuery('ui_policy', SOLO_ID); s.addQuery('catalog_variable', 'IO:' + id); s.query();
            if (!s.next()) {
                gs.print('• Solo lectura: agregar ' + m.name);
                if (!DRY_RUN) {
                    s.initialize(); s.setValue('ui_policy', SOLO_ID); s.setValue('catalog_variable', 'IO:' + id);
                    if (s.isValidField('catalog_item')) s.setValue('catalog_item', ITEM_ID);
                    s.setValue('visible', 'ignore'); s.setValue('mandatory', 'ignore'); s.setValue('disabled', 'true'); s.insert();
                }
            }
        } else gs.print('❌ No se encontró policy "Solo lectura"');
    });

    // 4) Orden de variables (100 en 100) y set al final
    gs.print('\n--- 4) ORDEN');
    ORDEN_VARS.forEach(function (n, i) {
        var v = varRec(P + n), ord = (i + 1) * 100;
        if (!v) { gs.print('❌ No existe ' + P + n); return; }
        if (v.getValue('order') != ord) { gs.print('• ' + P + n + ': ' + v.getValue('order') + ' → ' + ord); v.setValue('order', ord); save(v); }
    });
    var setOrd = (ORDEN_VARS.length + 1) * 100;
    var io = new GlideRecord('io_set_item'); io.addQuery('sc_cat_item', ITEM_ID); io.query();
    while (io.next()) if (io.getValue('order') != setOrd) {
        gs.print('• set "' + io.getDisplayValue('variable_set') + '" (io_set_item): ' + io.getValue('order') + ' → ' + setOrd);
        io.setValue('order', setOrd); save(io);
    }

    // 5) onChange de limpieza: agregar matriz_*
    gs.print('\n--- 5) CLIENT SCRIPTS');
    var cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.query();
    while (cs.next()) {
        var code = cs.getValue('script') || '', mk = '';
        for (var k in LIMPIAR) if (code.indexOf('// ' + k + '\n') > -1 || code.indexOf('// ' + k + '\r') > -1) mk = k;
        if (!mk) continue;
        var mt = code.match(/var campos = (\[[^\]]*\]);/);
        if (!mt) { gs.print('❌ ' + mk + ': no se encontró "var campos"'); continue; }
        var campos = JSON.parse(mt[1]), add = [];
        MATRICES.forEach(function (m) { if (campos.indexOf(m.name) == -1) { campos.push(m.name); add.push(m.name); } });
        if (!add.length) { gs.print('• ' + mk + ': ya limpia matrices'); continue; }
        gs.print('• ' + mk + ' (' + cs.getValue('name') + '): agregar ' + add.join(', '));
        cs.setValue('script', code.replace(mt[0], 'var campos = ' + JSON.stringify(campos) + ';')); save(cs);
    }

    // 6) Descripción: link "T1" → "T1, T2"
    gs.print('\n--- 6) DESCRIPCIÓN');
    if (CAMBIAR_LINK_T2) {
        var re = /Alto Privilegio T1(?!,\s*T2)/g;
        var d = it.getValue('description') || '';
        if (re.test(d)) { gs.print('• description: "Alto Privilegio T1" → "Alto Privilegio T1, T2"'); it.setValue('description', d.replace(re, 'Alto Privilegio T1, T2')); save(it); }
        else gs.print('• description: no contiene "Alto Privilegio T1" sin T2 (revisar)');
        var td = new GlideRecord('sys_translated_text');
        td.addQuery('tablename', 'sc_cat_item'); td.addQuery('documentkey', ITEM_ID); td.addQuery('fieldname', 'description'); td.addQuery('language', 'es'); td.query();
        if (td.next()) {
            var tv = td.getValue('value') || ''; re.lastIndex = 0;
            if (re.test(tv)) { gs.print('• traducción es: mismo cambio'); td.setValue('value', tv.replace(re, 'Alto Privilegio T1, T2')); save(td); }
            else gs.print('• traducción es: no contiene "Alto Privilegio T1" sin T2');
        } else gs.print('• sin traducción es de description');
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
