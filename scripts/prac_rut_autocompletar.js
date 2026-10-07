/*
 * Practicantes (a6837d761b5736d0d4f1a756624bcb09) — planilla "Manejo de RUT":
 *   "Elegir Nombre completo desde lista desplegable, que mapee RUT, nombre, apellidos y username,
 *    pero que no muestre al usuario solicitante el RUT (información guardada por detrás)"
 * 1) Script Include nuevo BCHDatosUsuarioAjax (client callable): getDatos(sysparm_user_id) → rut (employee_number), nombres, apellidos, user_name.
 *    Si ya existe NO se modifica.
 * 2) u_prac_usuario_dominio_solicitante (referencia sys_user, muestra el nombre completo): etiqueta → ETIQUETA_USUARIO.
 * 3) Variable nueva u_prac_username_solicitante (texto, solo lectura) después de Apellidos.
 * 4) Client script onChange "Practicantes - Autocompletar datos solicitante" (solo portal) que llena RUT, nombres, apellidos y username.
 * 5) UI Policy "Ocultar RUT en portal" (solo catálogo): RUT oculto para el solicitante; se guarda igual y se ve en RITM / tarea.
 * 6) Textos (ARREGLAR_TEXTOS): " Seleccione aplicativo…" sin espacio inicial, "Descripción", "Apellidos del Solicitante".
 * Al cambiar textos actualiza la traducción es si existe. No toca values ni el Flow.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = 'a6837d761b5736d0d4f1a756624bcb09';
var ETIQUETA_USUARIO = 'Nombre completo del Solicitante';
var ARREGLAR_TEXTOS = true;

var SI_NAME = 'BCHDatosUsuarioAjax';
var SI_CODE = [
    "var BCHDatosUsuarioAjax = Class.create();",
    "BCHDatosUsuarioAjax.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {",
    "    // getDatos(sysparm_user_id) -> { rut, nombres, apellidos, user_name } del usuario activo (RUT = employee_number)",
    "    getDatos: function () {",
    "        var r = { rut: '', nombres: '', apellidos: '', user_name: '' };",
    "        var u = new GlideRecord('sys_user');",
    "        if (u.get(this.getParameter('sysparm_user_id')) && u.getValue('active') == '1') {",
    "            r.rut = u.getValue('employee_number') || '';",
    "            r.nombres = u.getValue('first_name') || '';",
    "            r.apellidos = u.getValue('last_name') || '';",
    "            r.user_name = u.getValue('user_name') || '';",
    "        }",
    "        return JSON.stringify(r);",
    "    },",
    "    type: 'BCHDatosUsuarioAjax'",
    "});"
].join('\n');
var CS_NAME = 'Practicantes - Autocompletar datos solicitante';
var CS_CODE = [
    "function onChange(control, oldValue, newValue, isLoading, isTemplate) {",
    "    // PRAC_AUTOCOMPLETAR: al elegir el nombre completo del solicitante llena RUT (oculto en el portal), nombres, apellidos y username",
    "    var RUT = 'u_prac_rut_solicitante', NOM = 'u_prac_nombres_solicitante', APE = 'u_prac_apellidos_solicitante', USR = 'u_prac_username_solicitante';",
    "    if (isLoading) return;",
    "    if (!newValue) {",
    "        g_form.clearValue(RUT); g_form.clearValue(NOM); g_form.clearValue(APE); g_form.clearValue(USR);",
    "        return;",
    "    }",
    "    var ga = new GlideAjax('BCHDatosUsuarioAjax');",
    "    ga.addParam('sysparm_name', 'getDatos');",
    "    ga.addParam('sysparm_user_id', newValue);",
    "    ga.getXMLAnswer(function (ans) {",
    "        var r = {};",
    "        try { r = JSON.parse(ans || '{}'); } catch (e) {}",
    "        g_form.setValue(RUT, r.rut || '');",
    "        g_form.setValue(NOM, r.nombres || '');",
    "        g_form.setValue(APE, r.apellidos || '');",
    "        g_form.setValue(USR, r.user_name || '');",
    "    });",
    "}"
].join('\n');

function v(name) { var g = new GlideRecord('item_option_new'); g.addQuery('cat_item', ITEM_ID); g.addQuery('name', name); g.query(); return g.next() ? g : null; }
function setTexto(gr, nuevo) {
    var actual = gr.getValue('question_text');
    var t = new GlideRecord('sys_translated_text');
    t.addQuery('tablename', 'item_option_new'); t.addQuery('documentkey', gr.getUniqueValue()); t.addQuery('fieldname', 'question_text'); t.addQuery('language', 'es'); t.query();
    var tieneEs = t.next();
    if (actual == nuevo && (!tieneEs || t.getValue('value') == nuevo)) { gs.print('   = ' + gr.getValue('name') + ': "' + nuevo + '" (ya está)'); return; }
    gs.print('   • ' + gr.getValue('name') + ': "' + actual + '" → "' + nuevo + '"' + (tieneEs ? ' (y traducción es: "' + t.getValue('value') + '")' : ''));
    if (DRY_RUN) return;
    gr.setValue('question_text', nuevo); gr.update();
    if (tieneEs) { t.setValue('value', nuevo); t.update(); }
}

gs.print('DRY_RUN = ' + DRY_RUN);
var item = new GlideRecord('sc_cat_item');
if (!item.get(ITEM_ID)) gs.print('❌ No existe el ítem');
else {
    gs.print('=== ' + item.getValue('name'));
    var USUARIO = v('u_prac_usuario_dominio_solicitante'), RUT = v('u_prac_rut_solicitante'), NOM = v('u_prac_nombres_solicitante'), APE = v('u_prac_apellidos_solicitante');
    if (!USUARIO || !RUT || !NOM || !APE) gs.print('❌ Faltan variables del solicitante; no se hace nada');
    else {
        // 1) Script Include
        gs.print('\n1) Script Include ' + SI_NAME);
        var si = new GlideRecord('sys_script_include'); si.addQuery('name', SI_NAME); si.query();
        if (si.next()) gs.print('   ya existe (' + si.getUniqueValue() + ') | client callable=' + si.getValue('client_callable') + ' | activo=' + si.getValue('active') + ': no se modifica');
        else {
            gs.print('   crear (client callable)');
            if (!DRY_RUN) {
                si.initialize(); si.setValue('name', SI_NAME); si.setValue('api_name', 'global.' + SI_NAME);
                si.setValue('client_callable', true); si.setValue('active', true); si.setValue('access', 'public');
                si.setValue('description', 'Homologación: datos del usuario elegido (RUT = employee_number, nombres, apellidos, username) para autocompletar catálogos.');
                si.setValue('script', SI_CODE);
                gs.print('   sys_id: ' + si.insert());
            }
        }
        // prueba con el usuario que corre el script
        var yo = new GlideRecord('sys_user'); yo.get(gs.getUserID());
        gs.print('   prueba con ' + yo.getValue('name') + ': rut="' + (yo.getValue('employee_number') || '') + '" | nombres="' + (yo.getValue('first_name') || '') + '" | apellidos="' + (yo.getValue('last_name') || '') + '" | username="' + yo.getValue('user_name') + '"');

        // 2) Etiqueta del usuario
        gs.print('\n2) Selección del solicitante (referencia sys_user, en la lista se ve el nombre completo)');
        setTexto(USUARIO, ETIQUETA_USUARIO);

        // 3) Variable username
        gs.print('\n3) Variable u_prac_username_solicitante');
        var USR = v('u_prac_username_solicitante');
        if (USR) gs.print('   ya existe (' + USR.getUniqueValue() + ') | activa=' + USR.getValue('active'));
        else {
            var ord = parseInt(APE.getValue('order'), 10) + 5;
            gs.print('   crear "Username del Solicitante" | texto una línea | solo lectura | orden ' + ord);
            if (!DRY_RUN) {
                var n = new GlideRecord('item_option_new'); n.initialize();
                n.setValue('cat_item', ITEM_ID); n.setValue('name', 'u_prac_username_solicitante'); n.setValue('question_text', 'Username del Solicitante');
                n.setValue('type', 6); n.setValue('order', ord); n.setValue('read_only', true); n.setValue('active', true);
                gs.print('   sys_id: ' + n.insert());
            }
        }

        // 4) Client script
        gs.print('\n4) Client script "' + CS_NAME + '" (onChange de u_prac_usuario_dominio_solicitante, solo portal)');
        var cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.addQuery('name', CS_NAME); cs.query();
        var existeCs = cs.next();
        gs.print('   ' + (existeCs ? (cs.getValue('script') == CS_CODE ? 'ya existe igual' : 'existe: actualizar código') : 'crear'));
        if (!DRY_RUN && !(existeCs && cs.getValue('script') == CS_CODE)) {
            if (!existeCs) { cs.initialize(); cs.setValue('cat_item', ITEM_ID); cs.setValue('name', CS_NAME); }
            cs.setValue('type', 'onChange'); cs.setValue('cat_variable', 'IO:' + USUARIO.getUniqueValue()); cs.setValue('ui_type', 10);
            cs.setValue('applies_catalog', true); cs.setValue('applies_req_item', false); cs.setValue('applies_sc_task', false);
            cs.setValue('active', true); cs.setValue('script', CS_CODE);
            gs.print('   sys_id: ' + (existeCs ? (cs.update(), cs.getUniqueValue()) : cs.insert()));
        }

        // 5) Ocultar RUT en el portal
        gs.print('\n5) UI Policy "Ocultar RUT en portal" (solo catálogo; en RITM / tarea se sigue viendo)');
        var p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID); p.addQuery('short_description', 'Ocultar RUT en portal'); p.query();
        var pid = p.next() ? p.getUniqueValue() : '';
        gs.print('   ' + (pid ? 'ya existe (' + pid + ')' : 'crear policy + acción RUT visible=false'));
        if (!DRY_RUN && !pid) {
            p.initialize(); p.setValue('catalog_item', ITEM_ID); p.setValue('short_description', 'Ocultar RUT en portal');
            p.setValue('catalog_conditions', ''); p.setValue('on_load', true); p.setValue('reverse_if_false', true); p.setValue('order', 50);
            p.setValue('applies_catalog', true); p.setValue('applies_req_item', false); p.setValue('applies_sc_task', false); p.setValue('active', true);
            pid = p.insert();
            var a = new GlideRecord('catalog_ui_policy_action'); a.initialize();
            a.setValue('ui_policy', pid); a.setValue('catalog_item', ITEM_ID); a.setValue('catalog_variable', 'IO:' + RUT.getUniqueValue());
            a.setValue('visible', 'false'); a.setValue('mandatory', 'ignore'); a.setValue('disabled', 'ignore');
            a.insert();
            gs.print('   sys_id: ' + pid);
        }

        // 6) Textos
        gs.print('\n6) Textos' + (ARREGLAR_TEXTOS ? '' : ' (ARREGLAR_TEXTOS = false, se omite)'));
        if (ARREGLAR_TEXTOS) {
            var app = v('u_prac_sel_app_acc'), desc = v('u_prac_usuario_descripcion_solicitud');
            if (app) setTexto(app, 'Seleccione aplicativo que requiere acceso');
            if (desc) setTexto(desc, 'Descripción de la solicitud');
            setTexto(APE, 'Apellidos del Solicitante');
        }
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
