import { Router } from 'express';
import * as locationController from '../controllers/location.controller.js';

const locationRouter = Router();
const communityRouter = Router();

locationRouter.get('/level/:level', locationController.getByLevel);
locationRouter.get('/children/:parentId', locationController.getChildren);
locationRouter.get('/communities', locationController.getCommunitiesByKebele);
locationRouter.get('/:id', locationController.getLocationById);

communityRouter.get('/:id', locationController.getCommunityById);

export { locationRouter, communityRouter };
