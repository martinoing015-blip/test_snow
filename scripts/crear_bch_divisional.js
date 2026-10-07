/*
 * Crea el Script Include BCHDivisional (NO client callable) y prueba con un usuario.
 *   new BCHDivisional().getDivisional(userSysId[, nombreGrupo, incluirseMismo])
 *     → sys_id del primer usuario de la cadena de jefaturas (manager, manager.manager, …) que es miembro
 *       del grupo "Divisionales" (o del grupo indicado). '' si no encuentra (cadena cortada o nadie en el grupo).
 *     incluirseMismo=true: si el propio usuario es divisional, se devuelve a él mismo (por defecto false: parte desde su jefatura).
 * Se usa desde una Action de Flow Designer ("Obtener divisional") con un paso de script.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura (solo prueba con la lógica, sin crear) | DRY_RUN=false CREA el Script Include
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var GRUPO = 'Divisionales';
var USUARIO_PRUEBA = 'user_previsto_test';   // user_name o sys_id de alguien real para probar

var SI_NAME = 'BCHDivisional';
var SI_CODE =
"var BCHDivisional = Class.create();\n" +
"BCHDivisional.prototype = {\n" +
"    initialize: function () {},\n" +
"\n" +
"    // Sube por la cadena de jefaturas hasta el primer miembro del grupo (por defecto 'Divisionales').\n" +
"    getDivisional: function (userId, nombreGrupo, incluirseMismo) {\n" +
"        var g = new GlideRecord('sys_user_group');\n" +
"        if (!g.get('name', nombreGrupo || 'Divisionales')) return '';\n" +
"        var u = new GlideRecord('sys_user');\n" +
"        if (!userId || !u.get(userId)) return '';\n" +
"        var actual = incluirseMismo ? u.getUniqueValue() : u.getValue('manager');\n" +
"        var visto = {};\n" +
"        for (var i = 0; actual && i < 15 && !visto[actual]; i++) {\n" +
"            visto[actual] = true;\n" +
"            var m = new GlideRecord('sys_user_grmember');\n" +
"            m.addQuery('group', g.getUniqueValue()); m.addQuery('user', actual); m.setLimit(1); m.query();\n" +
"            if (m.hasNext()) return actual;\n" +
"            var s = new GlideRecord('sys_user');\n" +
"            if (!s.get(actual)) break;\n" +
"            actual = s.getValue('manager');\n" +
"        }\n" +
"        return '';\n" +
"    },\n" +
"\n" +
"    type: 'BCHDivisional'\n" +
"};";

gs.print('DRY_RUN = ' + DRY_RUN);
var si = new GlideRecord('sys_script_include'); si.addQuery('name', SI_NAME); si.query();
if (si.next()) gs.print('• Script Include ' + SI_NAME + ' ya existe (' + si.getUniqueValue() + '): no se modifica');
else {
    gs.print('• crear Script Include ' + SI_NAME + ' (no client callable)');
    if (!DRY_RUN) {
        si.initialize();
        si.setValue('name', SI_NAME); si.setValue('api_name', 'global.' + SI_NAME);
        si.setValue('client_callable', false); si.setValue('active', true);
        si.setValue('description', 'Homologación: devuelve el divisional de un usuario (primer miembro del grupo Divisionales en su cadena de jefaturas).');
        si.setValue('script', SI_CODE);
        gs.print('  sys_id: ' + si.insert());
    }
}

// Prueba: misma lógica, mostrando cada paso
gs.print('\n--- Prueba con ' + USUARIO_PRUEBA);
var g = new GlideRecord('sys_user_group');
if (!g.get('name', GRUPO)) gs.print('⚠️ No existe el grupo "' + GRUPO + '": crearlo y cargar a los divisionales antes de usarlo');
var u = new GlideRecord('sys_user');
if (!u.get(USUARIO_PRUEBA)) { u = new GlideRecord('sys_user'); u.addQuery('user_name', USUARIO_PRUEBA); u.query(); u.next(); }
if (!u.isValidRecord()) gs.print('❌ No existe el usuario ' + USUARIO_PRUEBA);
else {
    gs.print('Previsto: ' + u.getValue('name') + ' (' + u.getValue('user_name') + ') | cargo: ' + (u.getValue('title') || '-'));
    var actual = u.getValue('manager'), nivel = 1, visto = {}, encontrado = '';
    while (actual && nivel <= 15 && !visto[actual]) {
        visto[actual] = true;
        var s = new GlideRecord('sys_user'); if (!s.get(actual)) break;
        var esta = false;
        if (g.isValidRecord()) { var m = new GlideRecord('sys_user_grmember'); m.addQuery('group', g.getUniqueValue()); m.addQuery('user', actual); m.query(); esta = m.hasNext(); }
        gs.print('   nivel ' + nivel + ': ' + s.getValue('name') + ' (' + s.getValue('user_name') + ') | cargo: ' + (s.getValue('title') || '-') + ' | en ' + GRUPO + ': ' + (esta ? 'SÍ ✅' : 'no'));
        if (esta) { encontrado = s.getValue('name'); break; }
        actual = s.getValue('manager'); nivel++;
    }
    if (!actual && !encontrado) gs.print('   (la cadena se corta: sin jefatura más arriba)');
    gs.print(encontrado ? '→ Divisional: ' + encontrado : '→ No se encontró divisional (el Flow debe ir a la rama de respaldo)');
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada creado)' : ' (cambios aplicados)'));
