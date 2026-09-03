import express from "express";
import { apiRouter } from "../src/server/apiRouter.js";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(apiRouter);

export default app;
