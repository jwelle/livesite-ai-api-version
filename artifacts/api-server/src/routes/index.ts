import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import demosRouter from "./demos";
import settingsRouter from "./settings";
import publicDemoRouter from "./publicDemo";
import adminRouter from "./admin";
import automationRouter from "./automation";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(publicDemoRouter);
router.use(automationRouter);
router.use(adminRouter);
router.use(demosRouter);
router.use(settingsRouter);

export default router;
