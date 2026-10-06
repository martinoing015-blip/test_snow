/*
 * Diagnóstico — Action "Llenar Wo Types": ¿siguen vivas las variables que usa?
 * Revisa cada path "var.xxx" / "var.xxx.campo" / "ritm.xxx" del MAP de la action:
 *   - el catálogo existe y está activo
 *   - la variable existe en el ítem o en uno de sus sets, y está ACTIVA
 *   - si hay dot-walk: la variable es de referencia y cada campo existe en la tabla
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada, no necesita update set)
 */
var CHECKS = [
    ['85fec90b1bc48310d4f1a756624bcb7f', 'Excepción Perfiles RBAC Servicio al Cliente', 'var.u_exc_perfs_rbac_cli_fecha_termino'],
    ['62fd5b9a1b333e1058f65425604bcb92', 'REDEC - RAN 18-5', 'var.seleccione_matriz_del_activo.u_pg_campo_01'],
    ['4c1c1c441b004b5058f65425604bcb55', 'Gestión de Grupos de AD Asociado a Aplicativo', 'var.u_gest_grp_ad_apli_usuario_responsable_app'],
    ['4c1c1c441b004b5058f65425604bcb55', 'Gestión de Grupos de AD Asociado a Aplicativo', 'var.u_gest_grp_ad_apli_usuario_responsable_grupo'],
    ['c40522681b4c4f50d4f1a756624bcba7', 'Cuentas de servicio Cloud', 'var.u_ctas_svc_cloud_unidad_responsable_rotacion'],
    ['c40522681b4c4f50d4f1a756624bcba7', 'Cuentas de servicio Cloud', 'var.u_ctas_svc_cloud_responsable_banco_banchile_credenciales.department.name'],
    ['c40522681b4c4f50d4f1a756624bcba7', 'Cuentas de servicio Cloud', 'var.u_ctas_svc_cloud_responsable_banco_banchile_credenciales.name'],
    ['c40522681b4c4f50d4f1a756624bcba7', 'Cuentas de servicio Cloud', 'var.u_ctas_svc_cloud_responsable_cuenta.department.name'],
    ['c40522681b4c4f50d4f1a756624bcba7', 'Cuentas de servicio Cloud', 'var.u_ctas_svc_cloud_responsable_cuenta.name'],
    ['c40522681b4c4f50d4f1a756624bcba7', 'Cuentas de servicio Cloud', 'var.u_ctas_svc_cloud_nombre_responsable_rotacion'],
    ['f978fac11b248b50d4f1a756624bcb87', 'Solicitudes Roles y Perfiles Nuevo ERP', 'var.u_sol_rol_perfs_nvo_erp_fecha_fin_acceso'],
    ['9ca645471b848310d4f1a756624bcb28', 'Activar Cuentas Temporales', 'var.u_act_ctas_temp_unidad_pertenece'],
    ['a8b179321b5736d0d4f1a756624bcb98', 'Reset de Contraseña - Aplicaciones', 'var.seleccione_aplicaci_n.u_pg_campo_03'],
    ['a8b179321b5736d0d4f1a756624bcb98', 'Reset de Contraseña - Aplicaciones', 'var.seleccione_aplicaci_n.u_pg_campo_023'],
    ['f2780b651b1fba90d4f1a756624bcb28', 'Creación Dominio BCH (Externos)', 'var.u_crea_dom_bch_ext_usuario_dominio_bch.employee_number'],
    ['f2780b651b1fba90d4f1a756624bcb28', 'Creación Dominio BCH (Externos)', 'var.u_crea_dom_bch_ext_usuario_dominio_bch.name'],
    ['f2780b651b1fba90d4f1a756624bcb28', 'Creación Dominio BCH (Externos)', 'var.u_crea_dom_bch_ext_rut_empresa'],
    ['6fd0fecc1b77765058f65425604bcbd7', 'Eliminación de Cuentas de Usuario', 'var.u_elim_ctas_usr_rut_pasaporte_usuario'],
    ['b91087a83be307102815757e53e45a8b', 'Gestión de Secretos Cloud', 'var.u_seccloud_unidad'],
    ['d0bdf1ef3bac87502815757e53e45ab8', 'Navegación privilegiada', 'var.u_nav_priv_fecha_termino'],
    ['f7ce90821b1b7e90d4f1a756624bcb2d', 'Creación Masiva Dominio BCH (Externos)', 'var.u_crea_mas_dom_bch_ext_usuario_dominio_bch.employee_number'],
    ['f7ce90821b1b7e90d4f1a756624bcb2d', 'Creación Masiva Dominio BCH (Externos)', 'var.u_crea_mas_dom_bch_ext_usuario_dominio_bch.name'],
    ['f7ce90821b1b7e90d4f1a756624bcb2d', 'Creación Masiva Dominio BCH (Externos)', 'var.u_crea_mas_dom_bch_ext_rut_empresa'],
    ['f7ce90821b1b7e90d4f1a756624bcb2d', 'Creación Masiva Dominio BCH (Externos)', 'ritm.company.name'],
    ['759eef3b3b6b07106977352eb3e45a08', 'Solicitud de Excepción DLP Office 365 (Externos)', 'var.u_sol_exc_dlp_o365_ext_fecha_termino']
];

function buscarVar(cat, name) {
    var sets = [], s = new GlideRecord('io_set_item'); s.addQuery('sc_cat_item', cat); s.query();
    while (s.next()) sets.push(s.getValue('variable_set'));
    var v = new GlideRecord('item_option_new'); var qc = v.addQuery('cat_item', cat);
    if (sets.length) qc.addOrCondition('variable_set', 'IN', sets.join(','));
    v.addQuery('name', name); v.orderByDesc('active'); v.setLimit(1); v.query();
    return v.next() ? v : null;
}
// recorre campos desde una tabla; devuelve '' si todo existe o el error
function revisarCampos(tabla, campos) {
    var t = tabla;
    for (var i = 0; i < campos.length; i++) {
        var g = new GlideRecord(t);
        if (!g.isValid()) return 'tabla ' + t + ' no existe';
        if (!g.isValidField(campos[i])) return 'campo ' + t + '.' + campos[i] + ' no existe';
        if (i < campos.length - 1) {
            var sig = g.getElement(campos[i]).getReferenceTable();
            if (!sig) return t + '.' + campos[i] + ' no es referencia (no se puede seguir)';
            t = sig;
        }
    }
    return '';
}

var ok = 0, mal = 0;
CHECKS.forEach(function (c) {
    var cat = c[0], nom = c[1], path = c[2], err = '', info = '';
    var it = new GlideRecord('sc_cat_item');
    if (!it.get(cat)) err = 'catálogo no existe';
    else {
        if (it.getValue('active') != '1') info += ' [catálogo INACTIVO]';
        if (path.indexOf('ritm.') == 0) {
            err = revisarCampos('sc_req_item', path.replace('ritm.', '').split('.'));
        } else {
            var parts = path.replace('var.', '').split('.');
            var v = buscarVar(cat, parts[0]);
            if (!v) err = 'variable ' + parts[0] + ' no existe en el ítem ni en sus sets';
            else {
                if (v.getValue('active') != '1') err = 'variable ' + parts[0] + ' está INACTIVA';
                info += ' (' + v.getDisplayValue('type') + (v.getValue('variable_set') ? ', set ' + v.getDisplayValue('variable_set') : '') + ')';
                if (!err && parts.length > 1) {
                    var ref = v.getValue('reference');
                    if (!ref) err = 'variable ' + parts[0] + ' no es de referencia; no se puede hacer .' + parts.slice(1).join('.');
                    else err = revisarCampos(ref, parts.slice(1));
                }
            }
        }
    }
    if (err) { mal++; gs.print('❌ ' + nom + ' | ' + path + ' → ' + err + info); }
    else { ok++; gs.print('✅ ' + nom + ' | ' + path + info); }
});
gs.print('\nOK: ' + ok + ' | Con problema: ' + mal);
gs.print('FIN (solo lectura)');
