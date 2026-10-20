package com.dev.backend.config;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.entities.ChiTietQuyenKhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.ChiTietQuyenKho;
import com.dev.backend.services.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.RequestHeader;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;

@Aspect
@Component
public class AuthorizationAspect {

    @Autowired
    private JwtService jwtService;
    @Autowired
    private HttpServletRequest request;


    @Around("@annotation(requireAuth)")
    public Object checkAuthorization(ProceedingJoinPoint joinPoint, RequireAuth requireAuth) throws Throwable {
        //tu request lay ra token
        String authHeader = getAuthHeader(joinPoint);
        String token = jwtService.getTokenFromAuthHeader(authHeader);

        String[] requiredRoles = requireAuth.roles();

        for (String role : requiredRoles) {
            if (role.equals(IRoleType.all)) {
                return joinPoint.proceed();
            }
        }

        NguoiDungAuthInfo nguoiDungAuthInfo = jwtService.getNguoiDungAuthInfoFromToken(token);

        // Quản trị viên có tất cả các quyền
        if (nguoiDungAuthInfo.getVaiTro().contains(IRoleType.quan_tri_vien)) {
            return joinPoint.proceed();
        }
        // Nếu không là quản trị viên sẽ check quyền và quyền hạn
        if (requiredRoles.length > 0) {
            boolean hasAccess = requireAuth.rolesLogic() == RequireAuth.LogicType.OR
                    ? jwtService.hasAnyRole(nguoiDungAuthInfo, requiredRoles)  // Có ít nhất 1 role
                    : jwtService.hasAllRoles(nguoiDungAuthInfo, requiredRoles); // Có tất cả roles

            if (!hasAccess) {
                throw new AccessDeniedException("Vai trò của bạn không được phép thực hiện thao tác này");
            }
        }
        //check theo Kho
        if (requireAuth.inWarehouse()) {
            Integer warehouseId = getWarehouseId(joinPoint);

            if (!jwtService.inWorkspace(warehouseId, nguoiDungAuthInfo)) {
                throw new AccessDeniedException("Bạn không thuộc kho đang chọn, vui lòng chọn lại kho");
            }

            if (requireAuth.permissions().length > 0) {
                boolean hasAccess = requireAuth.permissionsLogic() == RequireAuth.LogicType.OR
                        ? jwtService.hasAnyPermissionInWorkSpace(warehouseId, nguoiDungAuthInfo, requireAuth.permissions()) // Có ít nhất 1 permission
                        : jwtService.hasAllPermissionsInWorkSpace(warehouseId, nguoiDungAuthInfo, requireAuth.permissions()); // Có tất cả permissions
                if (!hasAccess) {
                    for (PhanQuyenNguoiDungKhoDto dto : nguoiDungAuthInfo.getPhanQuyenNguoiDungKhos()){
                        System.out.println(dto.getKho().getTenKho());
                      for (ChiTietQuyenKhoDto ctqk: dto.getChiTietQuyenKhos()){
                          System.out.println(ctqk.getQuyenHan().getMaQuyen());
                      }
                    }
                    throw new AccessDeniedException("Bạn không có quyền thực hiện thao tác này");
                }
            }
        }


        return joinPoint.proceed();
    }

    //lấy giá trị header Authorization để tách JWT token.
    private String getAuthHeader(ProceedingJoinPoint joinPoint) {
        // Thử lấy từ method parameter trước
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Parameter[] parameters = method.getParameters();
        Object[] args = joinPoint.getArgs();

        for (int i = 0; i < parameters.length; i++) {
            if (parameters[i].isAnnotationPresent(RequestHeader.class)) {
                RequestHeader header = parameters[i].getAnnotation(RequestHeader.class);
                if ("Authorization".equals(header.value())) {
                    return (String) args[i];
                }
            }
        }

        // Nếu không có trong parameter, lấy từ HttpServletRequest
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && !authHeader.isEmpty()) {
            return authHeader;
        }

        throw new AccessDeniedException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn");
    }

    public Integer getWarehouseId(ProceedingJoinPoint joinPoint) {
        // Tương tự, có thể thêm fallback từ request
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Parameter[] parameters = method.getParameters();
        Object[] args = joinPoint.getArgs();

        for (int i = 0; i < parameters.length; i++) {
            if (parameters[i].isAnnotationPresent(RequestHeader.class)) {
                RequestHeader header = parameters[i].getAnnotation(RequestHeader.class);
                if ("kho_id".equals(header.value())) {
                    return (Integer) args[i];
                }
            }
        }

        // Fallback: lấy từ request
        String khoIdStr = request.getHeader("kho_id");
        if (khoIdStr != null) {
            try {
                return Integer.parseInt(khoIdStr);
            } catch (NumberFormatException e) {
                throw new AccessDeniedException("Kho đang chọn không hợp lệ, vui lòng chọn lại kho");
            }
        }

        throw new AccessDeniedException("Bạn chưa chọn kho làm việc, vui lòng chọn kho");
    }
}
