import { AppError } from "../utils/appError.js";
export const errorHandler = (error, _req, res, _next) => {
    if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
    }
    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
};
