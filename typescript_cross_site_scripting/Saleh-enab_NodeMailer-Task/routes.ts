import { Express, Request, Response, NextFunction } from "express";
import { userModel } from "./user.model";
import { sendMail } from "./nodemailer";
import OTP from 'otp-generator';

export const routes = (app: Express) => {

    app.post('/register', async (req: Request, res: Response) => {
        try {
            const { name, email } = req.body;
            const user = await userModel.findOne({ email })
            if (user && user.isVerified) {
                return res.send("This Email has been registered before, Please try another one")
            } else if (user && !user.isVerified) {
                return res.redirect(`/verify/?user_id=${user._id}`);
            }
            const newUser = new userModel({
                name,
                email,
                OTPExpiration: Date.now() + 24 * 60 * 60 * 1000,
                OTP: OTP.generate(6, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false }),
                isVerified: false
            })
            await newUser.save();
            sendMail(newUser.email, newUser.OTP!, newUser.name)
            return res.status(201).send(`Registered Sussessfully, Go to: http://localhost:3000/verify/?user_id=${newUser._id} for Email verification.`)
        } catch (err) {
            console.error(err);
        }

    })

    app.post('/verify', async (req: Request, res: Response) => {
        try {
            const mailOTP = req.body.OTP
            const userId = req.query.user_id
            const user = await userModel.findById(userId)
            if (!user) {
                return res.send("Invalid User");
            }
            const userOTP = user.OTP
            if (userOTP === mailOTP && user.OTPExpiration && Date.now() < user.OTPExpiration) {
                user.isVerified = true
                user.OTP = undefined
                user.OTPExpiration = undefined
                await user.save()
                return res.status(200).send("Verified Successfully.");
            } else {
                return res.send("Failed to verify the Email.");
            }
        } catch (err) {
            console.error(err)
        }

    })
}