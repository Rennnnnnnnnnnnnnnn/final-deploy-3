import express from 'express';
// import { getInventoryByBatch , getTableValues, addItemType} from '../controllers/inventoryController.js';
import { getItemTypes, getItemStockDetails, addFeedsToStock, addSupplementsToStock, editFeedsStock, editSupplementsStock, deleteInventoryRecord, addChicksToStock, editChicksStock } from '../controllers/inventoryController.js';

const router = express.Router();

// GET ALL INVENTORY DETAILS BY BATCH ID
// router.get('/:batchId', getInventoryByBatch);

// router.get('/', getTableValues);



router.get('/item-types', getItemTypes);
router.post('/item-stock-details', getItemStockDetails);

router.post('/add-feeds-to-stock', addFeedsToStock);
router.post('/add-supplements-to-stock', addSupplementsToStock);
router.post('/add-chicks-to-stock', addChicksToStock);

router.delete('/delete-inventory-record/:id', deleteInventoryRecord);

router.post('/edit-feeds-in-stock', editFeedsStock);



router.post('/edit-chicks-in-stock', editChicksStock);


router.post('/edit-supplements-in-stock', editSupplementsStock);









export default router;
