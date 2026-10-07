/*
 * Crea el grupo "Divisionales" y carga sus miembros.
 * 1) Muestra CANDIDATOS: usuarios activos cuyo cargo (title) contiene "divisional" (solo para ayudar a armar la lista).
 * 2) Crea el grupo si no existe (activo, con descripción).
 * 3) Agrega los usuarios de MIEMBROS (user_name). Avisa los que no existen o ya son miembros.
 *    Si MIEMBROS está vacío y USAR_CANDIDATOS = true, agrega los candidatos del punto 1.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false CREA el grupo y los miembros
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var GRUPO = 'Divisionales';
var DESCRIPCION = 'Gerentes divisionales. Lo usa BCHDivisional para encontrar el divisional del previsto (aprobaciones de catálogo).';
var MIEMBROS = [   // user_name de los divisionales (pedir la lista a BCH)
];
var USAR_CANDIDATOS = false;   // true: si MIEMBROS está vacío, carga los candidatos por cargo

gs.print('DRY_RUN = ' + DRY_RUN);

// 1) Candidatos por cargo
gs.print('\n1) Candidatos (cargo contiene "divisional")');
var cand = [];
var c = new GlideRecord('sys_user'); c.addActiveQuery(); c.addQuery('title', 'CONTAINS', 'divisional'); c.orderBy('name'); c.query();
while (c.next()) { cand.push(c.getValue('user_name')); gs.print('   • ' + c.getValue('name') + ' (' + c.getValue('user_name') + ') | cargo: ' + c.getValue('title') + ' | depto: ' + (c.getDisplayValue('department') || '-')); }
if (!cand.length) gs.print('   (ninguno: el cargo no dice "divisional"; hay que pedir la lista a BCH)');

// 2) Grupo
gs.print('\n2) Grupo "' + GRUPO + '"');
var g = new GlideRecord('sys_user_group'), gid = '';
if (g.get('name', GRUPO)) { gid = g.getUniqueValue(); gs.print('   ya existe (' + gid + ') | activo=' + g.getValue('active')); }
else {
    gs.print('   crear (activo)');
    if (!DRY_RUN) {
        g.initialize(); g.setValue('name', GRUPO); g.setValue('description', DESCRIPCION); g.setValue('active', true);
        gid = g.insert(); gs.print('   sys_id: ' + gid);
    }
}

// 3) Miembros
var lista = MIEMBROS.length ? MIEMBROS : (USAR_CANDIDATOS ? cand : []);
gs.print('\n3) Miembros a cargar: ' + (lista.length ? lista.length : '0 (completar MIEMBROS o poner USAR_CANDIDATOS = true)'));
lista.forEach(function (un) {
    var u = new GlideRecord('sys_user'); u.addQuery('user_name', un); u.query();
    if (!u.next()) { u = new GlideRecord('sys_user'); u.addQuery('user_name', 'STARTSWITH', un + '@'); u.query(); if (!u.next()) { gs.print('   ❌ ' + un + ': no existe'); return; } }
    if (gid) {
        var m = new GlideRecord('sys_user_grmember'); m.addQuery('group', gid); m.addQuery('user', u.getUniqueValue()); m.query();
        if (m.hasNext()) { gs.print('   • ' + u.getValue('name') + ' (' + u.getValue('user_name') + '): ya es miembro'); return; }
    }
    gs.print('   • agregar ' + u.getValue('name') + ' (' + u.getValue('user_name') + ') | cargo: ' + (u.getValue('title') || '-') + (u.getValue('active') == '1' ? '' : ' ⚠️ inactivo'));
    if (!DRY_RUN && gid) { var n = new GlideRecord('sys_user_grmember'); n.initialize(); n.setValue('group', gid); n.setValue('user', u.getUniqueValue()); n.insert(); }
});
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada creado)' : ' (cambios aplicados)'));
