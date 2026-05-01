import { AppError } from "../utils/appError.js";
export const roleGuard = (...roles) => {
    return (req, _res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            throw new AppError("Forbidden", 403);
        }
        next();
    };
};
