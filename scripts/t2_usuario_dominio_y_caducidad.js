/*
 * Gestión de Cuenta con Alto Privilegio T2 — mismas 2 correcciones de la revisión que T1
 * 1) Usuario Dominio: Referencia → Texto de una sola línea; RUT y Nombre completo se llenan por GlideAjax
 *    (Script Include BCHUsuarioPorDominioAjax, el mismo de T1; si no existe se crea). El onChange de
 *    Usuario Dominio se reescribe (marcador T2_USUARIO_DOMINIO). Texto sin espacio inicial.
 * 2) Caducidad vigencia: si es Texto → Fecha (9).
 * Las variables se buscan por su texto (no se conoce el prefijo): revisar en el dry run que sean las correctas.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = 'c65920cf1b933ed058f65425604bcb62';   // Gestión de Cuenta con Alto Privilegio T2 (MAP de Wo Types)
var SI_NAME = 'BCHUsuarioPorDominioAjax';
var CS_NAME = 'onChange - Llenar RUT y Nombre desde Usuario Dominio';
var MARCADOR = 'T2_USUARIO_DOMINIO';

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

function csCode(USR, RUT, NOM) {
    return "function onChange(control, oldValue, newValue, isLoading) {\n" +
    "    // " + MARCADOR + "\n" +
    "    if (isLoading) return;\n" +
    "    var USR = '" + USR + "', RUT = '" + RUT + "', NOM = '" + NOM + "';\n" +
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
}
function porTexto(re) {   // variable activa del ítem cuyo texto (sin espacios) calza con re
    var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addActiveQuery(); v.orderBy('order'); v.query();
    while (v.next()) if (re.test((v.getValue('question_text') || '').trim())) return v;
    return null;
}

gs.print('DRY_RUN = ' + DRY_RUN);
var it = new GlideRecord('sc_cat_item');
if (!it.get(ITEM_ID)) gs.print('❌ No existe el ítem ' + ITEM_ID);
else {
    gs.print('Ítem: ' + it.getValue('name'));
    gs.print('\nVariables del ítem:');
    var all = new GlideRecord('item_option_new'); all.addQuery('cat_item', ITEM_ID); all.orderBy('order'); all.query();
    while (all.next()) gs.print('  [' + all.getValue('order') + '] ' + all.getValue('name') + ' | ' + all.getDisplayValue('type') + ' (' + all.getValue('type') + ') | "' + all.getValue('question_text') + '"' + (all.getValue('active') == '1' ? '' : ' | INACTIVA'));

    var usr = porTexto(/^usuario dominio$/i), rut = porTexto(/^rut$/i), nom = porTexto(/^nombre completo$/i), cad = porTexto(/^caducidad/i);
    gs.print('\nEncontradas: usuario=' + (usr ? usr.getValue('name') : '❌') + ' | rut=' + (rut ? rut.getValue('name') : '❌') +
        ' | nombre=' + (nom ? nom.getValue('name') : '❌') + ' | caducidad=' + (cad ? cad.getValue('name') : '❌'));

    // 1a) Script Include
    gs.print('\n1a) Script Include ' + SI_NAME);
    var si = new GlideRecord('sys_script_include'); si.addQuery('name', SI_NAME); si.query();
    if (si.next()) gs.print('   ya existe (' + si.getUniqueValue() + ') | se reutiliza');
    else {
        gs.print('   no existe → crear (client callable)');
        if (!DRY_RUN) {
            si.initialize();
            si.setValue('name', SI_NAME); si.setValue('api_name', 'global.' + SI_NAME);
            si.setValue('client_callable', true); si.setValue('active', true);
            si.setValue('description', 'Homologación Remedy: datos (RUT, nombre) de un usuario activo por nombre de usuario. Usado por Gestión de Cuenta con Alto Privilegio T1 y T2.');
            si.setValue('script', SI_CODE);
            gs.print('   sys_id: ' + si.insert());
        }
    }

    if (usr && rut && nom) {
        // 1b) Variable Usuario Dominio
        gs.print('\n1b) ' + usr.getValue('name'));
        if (usr.getValue('question_text') != 'Usuario Dominio') {
            gs.print('   texto "' + usr.getValue('question_text') + '" → "Usuario Dominio"');
            if (!DRY_RUN) usr.setValue('question_text', 'Usuario Dominio');
            var tr = new GlideRecord('sys_translated_text');
            tr.addQuery('tablename', 'item_option_new'); tr.addQuery('documentkey', usr.getUniqueValue()); tr.addQuery('fieldname', 'question_text'); tr.addQuery('language', 'es'); tr.query();
            if (tr.next() && tr.getValue('value') != 'Usuario Dominio') { gs.print('   traducción es "' + tr.getValue('value') + '" → "Usuario Dominio"'); if (!DRY_RUN) { tr.setValue('value', 'Usuario Dominio'); tr.update(); } }
        }
        if (usr.getValue('type') == '6') gs.print('   ya es Texto');
        else {
            var cnt = new GlideAggregate('sc_item_option_mtom');
            cnt.addQuery('sc_item_option.item_option_new', usr.getUniqueValue()); cnt.addNotNullQuery('sc_item_option.value'); cnt.addAggregate('COUNT'); cnt.query();
            var n = cnt.next() ? cnt.getAggregate('COUNT') : 0;
            gs.print('   ' + usr.getDisplayValue('type') + ' (' + usr.getValue('type') + ') → Texto (6) | referencia "' + usr.getValue('reference') + '" → vacía | RITM con valor: ' + n);
            if (!DRY_RUN) {
                usr.setValue('type', 6); usr.setValue('reference', ''); usr.setValue('reference_qual', ''); usr.setValue('attributes', '');
                if (usr.isValidField('use_reference_qualifier')) usr.setValue('use_reference_qualifier', 'simple');
            }
        }
        if (!DRY_RUN) usr.update();

        // 1c) Client script
        gs.print('\n1c) Client script');
        var code = csCode(usr.getValue('name'), rut.getValue('name'), nom.getValue('name'));
        var cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.addQuery('script', 'CONTAINS', MARCADOR); cs.query();
        if (cs.next()) gs.print('   ya existe "' + cs.getValue('name') + '" con ' + MARCADOR);
        else {
            cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.addQuery('type', 'onChange'); cs.addQuery('cat_variable', 'IO:' + usr.getUniqueValue()); cs.query();
            var c = cs.getRowCount();
            if (c > 1) gs.print('   ⚠️ hay ' + c + ' onChange sobre Usuario Dominio: se reescribe el primero, revisar los demás');
            if (cs.next()) {
                gs.print('   "' + cs.getValue('name') + '" → "' + CS_NAME + '" | código actual:\n' + cs.getValue('script') + '\n   código nuevo:\n' + code);
                if (!DRY_RUN) { cs.setValue('name', CS_NAME); cs.setValue('script', code); cs.update(); }
            } else {
                gs.print('   no hay onChange sobre Usuario Dominio → crear "' + CS_NAME + '"\n' + code);
                if (!DRY_RUN) {
                    cs.initialize(); cs.setValue('name', CS_NAME); cs.setValue('cat_item', ITEM_ID); cs.setValue('type', 'onChange');
                    cs.setValue('cat_variable', 'IO:' + usr.getUniqueValue()); cs.setValue('script', code); cs.setValue('active', true);
                    if (cs.isValidField('ui_type')) cs.setValue('ui_type', 10);
                    if (cs.isValidField('applies_catalog')) cs.setValue('applies_catalog', true);
                    gs.print('   sys_id: ' + cs.insert());
                }
            }
        }
    } else gs.print('\n❌ Falta Usuario Dominio, Rut o Nombre completo: no se toca la parte 1 (pegar el output)');

    // 2) Caducidad
    gs.print('\n2) Caducidad');
    if (!cad) gs.print('   ❌ no encontré la variable de caducidad');
    else if (cad.getValue('type') == '9' || cad.getValue('type') == '10') gs.print('   ' + cad.getValue('name') + ' ya es ' + cad.getDisplayValue('type'));
    else { gs.print('   ' + cad.getValue('name') + ' | ' + cad.getDisplayValue('type') + ' (' + cad.getValue('type') + ') → Fecha (9)'); if (!DRY_RUN) { cad.setValue('type', 9); cad.update(); } }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
