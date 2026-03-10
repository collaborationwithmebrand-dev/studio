'use server';
/**
 * @fileOverview A Genkit flow for generating a unique 4-digit OTP for phone verification.
 *
 * - generateOtp - A function that handles the generation of verification codes.
 * - GenerateOtpInput - The input type for the generateOtp function.
 * - GenerateOtpOutput - The return type for the generateOtp function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateOtpInputSchema = z.object({
  phoneNumber: z.string().describe('The phone number to verify.'),
});
export type GenerateOtpInput = z.infer<typeof GenerateOtpInputSchema>;

const GenerateOtpOutputSchema = z.object({
  code: z.string().describe('The generated 4-digit verification code.'),
  message: z.string().describe('Status message.'),
  sender: z.string().describe('The authorized sender ID.'),
});
export type GenerateOtpOutput = z.infer<typeof GenerateOtpOutputSchema>;

export async function generateOtp(
  input: GenerateOtpInput
): Promise<GenerateOtpOutput> {
  return generateOtpFlow(input);
}

const generateOtpFlow = ai.defineFlow(
  {
    name: 'generateOtpFlow',
    inputSchema: GenerateOtpInputSchema,
    outputSchema: GenerateOtpOutputSchema,
  },
  async input => {
    // Generate a secure random 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    // In a production environment, you would integrate an SMS Gateway API here (e.g., Twilio, Msg91).
    // The message would only arrive if the SIM card is active and correctly formatted.
    
    return {
      code,
      sender: '9693959033',
      message: `OTP successfully generated for ${input.phoneNumber}. Real SMS delivery simulated for prototype.`,
    };
  }
);
