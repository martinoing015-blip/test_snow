/*
 * Imperva DBF — corrección de la revisión: "Servidor" queda visible al cambiar de Requerimiento a Incidente
 * Causa: la policy "Mostrar - Servidor" solo mira "Seleccione su requerimiento" (no exige Tipo = Requerimiento)
 * y al cambiar a Incidente ese campo se oculta pero CONSERVA su valor → la condición sigue verdadera.
 * 1) "Mostrar - Servidor": condición = (Tipo = Requerimiento Y requerimiento en los mismos 5 valores de hoy)
 *    O (Tipo = Incidente Y incidente = Activación / Desactivación Agentes); borrar valor al ocultar.
 * 2) "Mostrar Requerimiento" y "Mostrar - Indicente ": borrar valor al ocultar; nombres
 *    "Mostrar - Seleccione su requerimiento" / "Mostrar - Seleccione tipo de incidente"; orden 100/200/300, Solo lectura 900.
 * Values sin cambio. Flow (Flujo A - Sin Aprobación, compartido) no usa variables: no se toca.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '2514b86e1bdb72d0d4f1a756624bcb16';
var P = 'u_imp_dbf_';
var REQ_CON_SERVIDOR = ['solicitud_de_informacion', 'cambios_en_agente', 'instalación_agente', 'registro_agente', 'gestion_de_cuentas'];
var INC_CON_SERVIDOR = ['activación _desactivación_agentes'];

gs.print('DRY_RUN = ' + DRY_RUN);
function io(n) { var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addQuery('name', P + n); v.query(); return v.next() ? 'IO:' + v.getUniqueValue() : null; }
var SOL = io('solicitud'), REQ = io('sel_requerimiento'), INC = io('sel_tipo_incidente');
if (!SOL || !REQ || !INC) gs.print('❌ Falta alguna variable');
else {
    var NOMBRE = {}; NOMBRE[SOL] = 'solicitud'; NOMBRE[REQ] = 'sel_requerimiento'; NOMBRE[INC] = 'sel_tipo_incidente'; NOMBRE[io('servidor')] = 'servidor';
    var COND_SERV = SOL + '=requerimiento^' + REQ_CON_SERVIDOR.map(function (x) { return REQ + '=' + x; }).join('^OR') +
        '^NQ' + SOL + '=incidente^' + INC_CON_SERVIDOR.map(function (x) { return INC + '=' + x; }).join('^OR') + '^EQ';
    var POL = [   // [empieza con, nombre nuevo, orden, condición nueva o null]
        ['Mostrar Requerimiento', 'Mostrar - Seleccione su requerimiento', 100, null],
        ['Mostrar - Seleccione su requerimiento', 'Mostrar - Seleccione su requerimiento', 100, null],
        ['Mostrar - Indicente', 'Mostrar - Seleccione tipo de incidente', 200, null],
        ['Mostrar - Seleccione tipo de incidente', 'Mostrar - Seleccione tipo de incidente', 200, null],
        ['Mostrar - Servidor', 'Mostrar - Servidor', 300, COND_SERV],
        ['Solo lectura', 'Solo lectura', 900, null]
    ];
    var p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID); p.addActiveQuery(); p.query();
    while (p.next()) {
        var nom = p.getValue('short_description'), def = null;
        POL.forEach(function (d) { if (!def && nom.indexOf(d[0]) == 0) def = d; });
        if (!def) { gs.print('⚠️ "' + nom + '" no reconocida, no se toca'); continue; }
        var cambios = [];
        if (nom != def[1]) { cambios.push('nombre → "' + def[1] + '"'); p.setValue('short_description', def[1]); }
        if (p.getValue('order') != String(def[2])) { cambios.push('orden ' + p.getValue('order') + ' → ' + def[2]); p.setValue('order', def[2]); }
        if (def[3] && p.getValue('catalog_conditions') != def[3]) { cambios.push('cond → (Requerimiento Y requerimiento con servidor) O (Incidente Y Activación / Desactivación Agentes)'); p.setValue('catalog_conditions', def[3]); }
        gs.print('• "' + nom + '"' + (cambios.length ? ': ' + cambios.join(' | ') : ': sin cambio'));
        if (cambios.length && !DRY_RUN) p.update();
        if (def[1] == 'Solo lectura') continue;
        var a = new GlideRecord('catalog_ui_policy_action'); a.addQuery('ui_policy', p.getUniqueValue()); a.query();
        while (a.next()) {
            if (a.getValue('visible') != 'true' || a.getValue('value_action') == 'clearValue') continue;
            gs.print('   → ' + (NOMBRE[a.getValue('catalog_variable')] || a.getValue('catalog_variable')) + ' | BORRAR VALOR');
            if (!DRY_RUN) { a.setValue('value_action', 'clearValue'); a.update(); }
        }
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
