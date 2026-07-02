import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma.service';

const SYSTEM_PROMPT = `You are an order-taking assistant for an FMCG distribution company in Nepal. Your job is to help sales reps record shop orders accurately and efficiently.

Rules:
- Extract shop name, product names, and quantities from what the rep says
- Confirm back clearly before saving: "ShopName: Nx Product, Mx Product2. Confirm?"
- Be brief and direct. No small talk.
- Support Nepali-English mixed input (e.g. "Ramesh Pasal - 2 wai wai, 5 sunsilk, 1 carton pepsi")
- If shop name is missing, ask for it
- If quantities are unclear, ask for clarification
- When rep confirms (says yes/ho/thik cha/confirm), respond with "ORDER_SAVED" followed by a brief confirmation
- Never make up products the rep didn't mention
- Typical FMCG products in Nepal: Wai Wai, Sunsilk, Pepsi, Coca Cola, Kurkure, Maggi, Lifebuoy, Lux, Rim Bri, Goldstar shoes, etc.

Response format when extracting an order:
Shop: [shop name]
Items:
- [qty] x [product]
- [qty] x [product]
Confirm? (yes/no)`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ChatService {
  private anthropic: Anthropic;

  constructor(private prisma: PrismaService) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async chat(
    sessionId: string,
    repId: string,
    message: string,
  ): Promise<{ reply: string; orderSaved?: boolean }> {
    // Get or create session
    let session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      // Verify rep exists, create if not
      let rep = await this.prisma.rep.findUnique({ where: { id: repId } });
      if (!rep) {
        rep = await this.prisma.rep.create({
          data: { id: repId, name: 'Rep' },
        });
      }
      session = await this.prisma.session.create({
        data: {
          id: sessionId,
          repId: repId,
          messages: [],
        },
      });
    }

    // Load conversation history
    const history: ChatMessage[] = session.messages as ChatMessage[];

    // Build messages for Claude
    const claudeMessages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Add the new user message
    claudeMessages.push({
      role: 'user',
      content: message,
    });

    // Call Claude
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    // Update session with new messages
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: reply });

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { messages: history },
    });

    // Check if order was confirmed (AI says ORDER_SAVED)
    let orderSaved = false;
    if (reply.includes('ORDER_SAVED')) {
      orderSaved = true;
      // Try to extract order data from conversation
      await this.extractAndSaveOrder(sessionId, repId, history);
    }

    return { reply: reply.replace('ORDER_SAVED', '').trim(), orderSaved };
  }

  private async extractAndSaveOrder(
    sessionId: string,
    repId: string,
    history: ChatMessage[],
  ) {
    // Use Claude to extract structured order data
    const extractionPrompt = `Based on this conversation, extract the order information as JSON.
Return ONLY valid JSON in this exact format, nothing else:
{"shopName": "shop name here", "items": [{"name": "product name", "qty": 1, "unit": "carton/piece/box"}]}

Conversation:
${history.map((m) => `${m.role}: ${m.content}`).join('\n')}`;

    const extractResponse = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: extractionPrompt }],
    });

    const extractText =
      extractResponse.content[0].type === 'text'
        ? extractResponse.content[0].text
        : '';

    try {
      // Try to parse JSON from response
      const jsonMatch = extractText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const orderData = JSON.parse(jsonMatch[0]);

        await this.prisma.order.create({
          data: {
            repId,
            sessionId,
            shopName: orderData.shopName || 'Unknown Shop',
            items: orderData.items || [],
            status: 'PENDING',
          },
        });
      }
    } catch (e) {
      // If extraction fails, still mark that we attempted
      console.error('Failed to extract order:', e);
      // Create order with raw data
      await this.prisma.order.create({
        data: {
          repId,
          sessionId,
          shopName: 'Check conversation',
          items: { raw: extractText },
          status: 'PENDING',
        },
      });
    }
  }
}
