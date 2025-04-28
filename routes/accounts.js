
import express, { Router } from 'express';
import { getAccounts, addAccount, getAccountDetails, updateAccount, deleteAccount, accountChangePassword, verifyPassword } from '../controllers/accountsController.js'; 

const router = express.Router();  

router.get('/', getAccounts); 

router.get('/:account_id', getAccountDetails)

router.put('/:account_id', updateAccount);

router.delete('/:account_id', deleteAccount);

router.post('/change-password/:account_id', accountChangePassword);

router.post('/verify-password/:account_id', verifyPassword);

router.post('/add-account', addAccount);

export default router;
