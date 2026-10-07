/*
 * Gestión de Cuenta con Alto Privilegio T1 — Usuario Dominio como texto (como la planilla)
 * En el portal, una variable Referencia siempre muestra el nombre del usuario (display value de sys_user);
 * los atributos ref_ac_* no lo cambian. Por eso:
 * 1) Script Include nuevo BCHUsuarioPorDominioAjax (client callable): getDatos(sysparm_user_name)
 *    → { encontrados, rut, nombre, user_name }. Busca usuario activo por user_name exacto y, si no hay,
 *    por "user_name@…" (se puede escribir solo la parte antes del @).
 * 2) u_gest_cta_altpriv_t1_usuario_dominio: Referencia (8) → Texto de una sola línea (6), sin referencia ni atributos.
 * 3) El onChange "Onchange - Rellenar datos-user" se reescribe con GlideAjax y pasa a llamarse
 *    "onChange - Llenar RUT y Nombre desde Usuario Dominio" (marcador T1_USUARIO_DOMINIO).
 *    Si el usuario no existe: mensaje de error y se borra el campo (obligatorio → no deja enviar).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '4adb81813bddc7902815757e53e45a22';
var P = 'u_gest_cta_altpriv_t1_';
var SI_NAME = 'BCHUsuarioPorDominioAjax';
var CS_NAME = 'onChange - Llenar RUT y Nombre desde Usuario Dominio';
var MARCADOR = 'T1_USUARIO_DOMINIO';

var SI_CODE =
"var BCHUsuarioPorDominioAjax = Class.create();\n" +
"BCHUsuarioPorDominioAjax.prototype = Object.extendsObject(AbstractAjaxProcessor, {\n" +
"    // Datos de un usuario activo por nombre de usuario (exacto, o la parte antes del @)\n" +
"    getDatos: function () {\n" +
"        var u = String(this.getParameter('sysparm_user_name') || '').trim();\n" +
"        var r = { encontrados: 0, rut: '', nombre: '', user_name: '' };\n" +
"        if (!u) return JSON.stringify(r);\n" +
"        var g = new GlideRecord('sys_user');\n" +
"        g.addActiveQuery(); g.addQuery('user_name', u); g.setLimit(2); g.query();\n" +
"        if (!g.hasNext()) {\n" +
"            g = new GlideRecord('sys_user');\n" +
"            g.addActiveQuery(); g.addQuery('user_name', 'STARTSWITH', u + '@'); g.setLimit(2); g.query();\n" +
"        }\n" +
"        while (g.next()) {\n" +
"            r.encontrados++;\n" +
"            r.rut = g.getValue('employee_number') || ''; r.nombre = g.getValue('name') || ''; r.user_name = g.getValue('user_name');\n" +
"        }\n" +
"        if (r.encontrados > 1) { r.rut = ''; r.nombre = ''; r.user_name = ''; }\n" +
"        return JSON.stringify(r);\n" +
"    },\n" +
"    type: 'BCHUsuarioPorDominioAjax'\n" +
"});";

var CS_CODE =
"function onChange(control, oldValue, newValue, isLoading) {\n" +
"    // " + MARCADOR + "\n" +
"    if (isLoading) return;\n" +
"    var USR = '" + P + "usuario_dominio', RUT = '" + P + "usuario_rut', NOM = '" + P + "usuario_nombre_completo';\n" +
"    g_form.clearValue(RUT);\n" +
"    g_form.clearValue(NOM);\n" +
"    if (!newValue) return;   // si se borró por error, el mensaje se mantiene\n" +
"    g_form.hideFieldMsg(USR, true);\n" +
"    var ga = new GlideAjax('" + SI_NAME + "');\n" +
"    ga.addParam('sysparm_name', 'getDatos');\n" +
"    ga.addParam('sysparm_user_name', newValue);\n" +
"    ga.getXMLAnswer(function (answer) {\n" +
"        var r = {};\n" +
"        try { r = JSON.parse(answer); } catch (e) {}\n" +
"        if (r.encontrados == 1) {\n" +
"            g_form.setValue(RUT, r.rut);\n" +
"            g_form.setValue(NOM, r.nombre);\n" +
"        } else {\n" +
"            g_form.clearValue(USR);\n" +
"            g_form.showFieldMsg(USR, r.encontrados > 1 ?\n" +
"                'Hay más de un usuario que coincide, ingrese el nombre de usuario completo.' :\n" +
"                'No existe un usuario activo con ese nombre de usuario.', 'error');\n" +
"        }\n" +
"    });\n" +
"}";

gs.print('DRY_RUN = ' + DRY_RUN);

// 1) Script Include
gs.print('\n1) Script Include ' + SI_NAME);
var si = new GlideRecord('sys_script_include'); si.addQuery('name', SI_NAME); si.query();
if (si.next()) gs.print('   ya existe (' + si.getUniqueValue() + ') | client callable=' + si.getValue('client_callable') + ' | no se modifica');
else {
    gs.print('   crear | client callable | activo');
    if (!DRY_RUN) {
        si.initialize();
        si.setValue('name', SI_NAME); si.setValue('api_name', 'global.' + SI_NAME);
        si.setValue('client_callable', true); si.setValue('active', true);
        si.setValue('description', 'Homologación Remedy: datos (RUT, nombre) de un usuario activo por nombre de usuario. Usado por Gestión de Cuenta con Alto Privilegio T1.');
        si.setValue('script', SI_CODE);
        gs.print('   sys_id: ' + si.insert());
    }
}

// 2) Variable
gs.print('\n2) Variable ' + P + 'usuario_dominio');
var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', P + 'usuario_dominio'); v.query();
if (!v.next()) gs.print('❌ No existe');
else {
    var cnt = new GlideAggregate('sc_item_option_mtom');
    cnt.addQuery('sc_item_option.item_option_new', v.getUniqueValue()); cnt.addNotNullQuery('sc_item_option.value'); cnt.addAggregate('COUNT'); cnt.query();
    var n = cnt.next() ? cnt.getAggregate('COUNT') : 0;
    gs.print('   tipo ' + v.getDisplayValue('type') + ' (' + v.getValue('type') + ') → Texto de una sola línea (6) | RITM con valor: ' + n +
        (n > 0 ? ' (en esos RITM quedará el sys_id como texto; instancia dev)' : ''));
    gs.print('   referencia "' + v.getValue('reference') + '", qual "' + v.getValue('reference_qual') + '", attributes "' + v.getValue('attributes') + '" → vacíos');
    if (!DRY_RUN && v.getValue('type') != '6') {
        v.setValue('type', 6); v.setValue('reference', ''); v.setValue('reference_qual', ''); v.setValue('attributes', '');
        if (v.isValidField('use_reference_qualifier')) v.setValue('use_reference_qualifier', 'simple');
        v.update();
    }
}

// 3) Client script
gs.print('\n3) Client script');
var cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.addQuery('script', 'CONTAINS', MARCADOR); cs.query();
if (cs.next()) gs.print('   ya existe "' + cs.getValue('name') + '" con ' + MARCADOR + ' | no se modifica');
else {
    cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.addQuery('name', 'Onchange - Rellenar datos-user'); cs.query();
    if (!cs.next()) gs.print('❌ No encontré "Onchange - Rellenar datos-user"');
    else {
        gs.print('   "' + cs.getValue('name') + '" → "' + CS_NAME + '" | código nuevo:');
        gs.print(CS_CODE);
        if (!DRY_RUN) { cs.setValue('name', CS_NAME); cs.setValue('script', CS_CODE); cs.update(); }
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
