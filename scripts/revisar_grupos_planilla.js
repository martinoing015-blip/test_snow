/*
 * Revisión de grupos de la planilla (filas "Falta" / "Falta (parecido)") — SOLO LECTURA
 * Por cada fila:
 *   1) Grupo de la planilla (última columna): ¿existe? (nombre exacto o parecido)
 *   2) Grupos "parecidos" (columna 3): ¿existen?, activos, cuántos miembros
 *   3) Catálogos de la fila: ¿existen?, qué grupos tienen hoy (Grupo de cumplimiento + Grupo tarea 1..5) y link
 *   4) Otros catálogos que ya usan el grupo de la planilla o los parecidos
 *   (Los miembros no se revisan: aún no están cargados en la instancia.)
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada)
 */
var URL = 'https://bancochileciberdev.service-now.com/';
var FILAS = [
    { fila: 'MFA', grupo: 'Desenrolamiento MFA - Banchile', parecidos: ['Desenrolamiento MFA', 'Aprobación MFA SWIFT'],
      catalogos: ['Desvincular dispositivo de MFA - Banchile Inversiones'], miembros: ['cgaldamesca', 'lcatrils', 'rlataste'] },
    { fila: 'Multicloud', grupo: 'Multicloud', parecidos: ['Servicios Multicloud'],
      catalogos: ['Amazon Web Services', 'Google Cloud Platform', 'Microsoft Azure', 'Oracle Cloud Infrastructure', 'Solicitud Masiva Entorno Multicloud'],
      miembros: ['jleviman', 'mabustos', 'pcmirandar'] },
    { fila: 'Gestión Grupos AD', grupo: 'Gestión Grupos AD', parecidos: ['Creación Grupo AD'],
      catalogos: ['Gestión de Grupos de AD Asociado a Aplicativo'], miembros: ['ovillao', 'rlataste'] },
    { fila: 'Excepción reemplazo', grupo: 'Excepción reemplazo', parecidos: [],
      catalogos: ['Excepción por reemplazo'], miembros: ['csanchezr', 'ccancinom', 'ieguia', 'jleviman'] },
    { fila: 'Data Safe', grupo: 'Data Safe', parecidos: ['Operaciones Data Safe'],
      catalogos: ['Data Safe'], miembros: [] },
    { fila: 'Excepción MFA SWIFT', grupo: 'Excepción MFA SWIFT', parecidos: ['Aprobación MFA SWIFT'],
      catalogos: ['Solicitud Excepción MFA SWIFT'], miembros: ['rlataste', 'baravenac'] },
    { fila: 'Excepción Perfil Matriz Cargo Perfil', grupo: 'Excepción Perfil Matriz Cargo Perfil', parecidos: ['Matriz Cargo Perfil', 'Excepcion perfil matriz RBAC'],
      catalogos: ['Excepción Perfil Matriz Cargo Perfil'], miembros: ['cgaldamesca', 'cramirezlo', 'cnunezc'] },
    { fila: 'Servicios Cloud', grupo: 'Servicios Cloud', parecidos: [],
      catalogos: ['Cuentas de servicio Cloud'], miembros: ['lcatrils', 'lgonzaleh', 'mabustos'] },
    { fila: 'Gestión BD', grupo: 'Gestión BD', parecidos: [],
      catalogos: ['Gestión de Cuentas en Base de Datos'], miembros: ['lcatrils', 'lgonzaleh', 'mabustos'] },
    { fila: 'Equipo P&O', grupo: 'Equipo P&O', parecidos: [],
      catalogos: ['Grupo Renuncia', 'Deshabilitación por Desvinculación'], miembros: ['pcmirandar', 'cramirezlo'] },
    { fila: 'Gestión Exchange', grupo: 'Gestión Exchange', parecidos: ['Soporte Exchange'],
      catalogos: ['Gestión de Listas de Distribución'], miembros: ['ccancinom', 'ieguia', 'jleviman'] },
    { fila: 'Data deudores', grupo: 'Data deudores', parecidos: ['Acceso Data Deudores'],
      catalogos: ['RAN 18-5', 'Acceso a información de deudores CMF'], miembros: ['lcatrils', 'lgonzaleh'] },
    { fila: 'RDP', grupo: 'RDP', parecidos: ['Autorización RDP', 'Habilitación de Acceso por RDP'],
      catalogos: ['Permisos de Conexión RDP'], miembros: ['rlataste', 'lcatrils'] },
    { fila: 'UASC', grupo: 'UASC', parecidos: ['Aprobación UASC', 'UASC - Socofin', 'XSOAR UASC'],
      catalogos: ['Permisos de Conexión RDP'], miembros: [] }
];

// campos de grupo del ítem
var CAMPOS = [];
var d = new GlideRecord('sys_dictionary'); d.addQuery('name', 'IN', 'sc_cat_item,sc_cat_item_producer'); d.addQuery('internal_type', 'reference'); d.addQuery('reference', 'sys_user_group'); d.query();
while (d.next()) if (CAMPOS.indexOf(d.getValue('element')) == -1) CAMPOS.push(d.getValue('element'));

function grupos(nombre, exacto) {   // [{id, name, active, miembros}]
    var r = [], g = new GlideRecord('sys_user_group');
    if (exacto) g.addQuery('name', nombre); else g.addQuery('name', 'CONTAINS', nombre);
    g.query();
    while (g.next()) {
        var m = new GlideAggregate('sys_user_grmember'); m.addQuery('group', g.getUniqueValue()); m.addAggregate('COUNT'); m.query();
        r.push({ id: g.getUniqueValue(), name: g.getValue('name'), active: g.getValue('active'), miembros: m.next() ? m.getAggregate('COUNT') : 0 });
    }
    return r;
}
function gTxt(g) { return '"' + g.name + '" | activo=' + g.active + ' | ' + g.miembros + ' miembros | ' + URL + 'sys_user_group.do?sys_id=' + g.id; }
function itemsPorNombre(n) {
    var ids = [], c = new GlideRecord('sc_cat_item'); c.addQuery('name', 'CONTAINS', n); c.query();
    while (c.next()) ids.push(c.getUniqueValue());
    var t = new GlideRecord('sys_translated_text'); t.addQuery('tablename', 'sc_cat_item'); t.addQuery('fieldname', 'name'); t.addQuery('language', 'es'); t.addQuery('value', 'CONTAINS', n); t.query();
    while (t.next()) if (ids.indexOf(t.getValue('documentkey')) == -1) ids.push(t.getValue('documentkey'));
    return ids;
}
function gruposItem(x) {
    var r = [];
    CAMPOS.forEach(function (c) { if (x.isValidField(c) && x.getValue(c)) r.push(x[c].getLabel() + ' = ' + x.getDisplayValue(c)); });
    return r.join(' | ') || '(sin grupos)';
}

FILAS.forEach(function (f) {
    gs.print('\n==================== ' + f.fila + '  →  grupo planilla: "' + f.grupo + '"');

    // 1) Grupo de la planilla
    var exacto = grupos(f.grupo, true), similares = exacto.length ? [] : grupos(f.grupo, false);
    if (exacto.length) exacto.forEach(function (g) { gs.print('1) ✅ existe ' + gTxt(g)); });
    else if (similares.length) { gs.print('1) ⚠️ no existe exacto; nombres que lo contienen:'); similares.forEach(function (g) { gs.print('     • ' + gTxt(g)); }); }
    else gs.print('1) ❌ no existe ningún grupo con "' + f.grupo + '"');

    // 2) Parecidos
    var PAR = [];
    f.parecidos.forEach(function (p) {
        var ps = grupos(p, false);
        if (!ps.length) gs.print('2) ❌ parecido "' + p + '": no existe');
        ps.forEach(function (g) { PAR.push(g); gs.print('2) • parecido "' + p + '": ' + gTxt(g)); });
    });
    if (!f.parecidos.length) gs.print('2) (la planilla no indica parecidos)');

    var OBJ = {}; exacto.concat(similares).forEach(function (g) { OBJ[g.id] = 'planilla'; }); PAR.forEach(function (g) { if (!OBJ[g.id]) OBJ[g.id] = 'parecido'; });

    // 3) Catálogos de la fila
    var vistos = {};
    f.catalogos.forEach(function (n) {
        var ids = itemsPorNombre(n);
        if (!ids.length) { gs.print('3) ❌ catálogo "' + n + '": no encontrado'); return; }
        ids.forEach(function (sid) {
            if (vistos[sid]) return; vistos[sid] = true;
            var x = new GlideRecord('sc_cat_item'); if (!x.get(sid)) return;
            var tipo = '';
            CAMPOS.forEach(function (c) { if (x.isValidField(c) && OBJ[x.getValue(c)]) tipo = tipo || OBJ[x.getValue(c)]; });
            gs.print('3) ' + (tipo == 'planilla' ? '✅' : tipo == 'parecido' ? '🟡' : '⚠️') + ' ' + x.getValue('name') + ' | activo=' + x.getValue('active') +
                ' | ' + gruposItem(x) + '\n     ' + URL + 'sc_cat_item.do?sys_id=' + sid);
        });
    });

    // 4) Otros catálogos con esos grupos
    var gids = Object.keys(OBJ);
    if (gids.length && CAMPOS.length) {
        var it = new GlideRecord('sc_cat_item'), qc = it.addQuery(CAMPOS[0], 'IN', gids.join(','));
        for (var i = 1; i < CAMPOS.length; i++) qc.addOrCondition(CAMPOS[i], 'IN', gids.join(','));
        it.query();
        var otros = [];
        while (it.next()) if (!vistos[it.getUniqueValue()]) otros.push('     • ' + it.getValue('name') + ' | activo=' + it.getValue('active') + ' | ' + gruposItem(it) + ' | ' + URL + 'sc_cat_item.do?sys_id=' + it.getUniqueValue());
        gs.print('4) Otros catálogos con estos grupos: ' + (otros.length ? '\n' + otros.join('\n') : 'ninguno'));
    }
});
gs.print('\nFIN (solo lectura)');
