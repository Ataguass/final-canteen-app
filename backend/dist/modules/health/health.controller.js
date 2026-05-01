export const healthHandler = (_req, res) => {
    res.status(200).json({
        success: true,
        message: "ok",
        data: { uptime: process.uptime() }
    });
};
