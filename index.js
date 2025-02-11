const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits, REST, Routes } = require('discord.js');
const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildIntegrations
    ]
});

const products = new Map();

// دالة للتحقق من صلاحيات المستخدم
function hasAdminRole(member) {
    return member.roles.cache.has(config.ADMIN_ROLE_ID);
}

// تسجيل الأوامر قبل تشغيل البوت
const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);

async function main() {
    try {
        console.log('بدء تسجيل الأوامر...');

        const commands = [
            {
                name: 'ping',
                description: 'اختبار استجابة البوت'
            },
            {
                name: 'setup',
                description: 'إعداد متجر البوت'
            },
            {
                name: 'add',
                description: 'إضافة منتج جديد إلى المتجر',
                options: [
                    {
                        name: 'name',
                        description: 'اسم المنتج',
                        type: 3,
                        required: true
                    },
                    {
                        name: 'description',
                        description: 'وصف المنتج',
                        type: 3,
                        required: true
                    },
                    {
                        name: 'image',
                        description: 'رابط صورة المنتج (اختياري)',
                        type: 3,
                        required: false
                    }
                ]
            }
        ];

        console.log('بدء تحديث أوامر التطبيق...');

        await rest.put(
            Routes.applicationGuildCommands(config.bot_id, config.server_id),
            { body: commands }
        );

        console.log('تم تسجيل الأوامر بنجاح!');

        // تشغيل البوت
        client.login(config.BOT_TOKEN);
    } catch (error) {
        console.error('حدث خطأ:', error);
    }
}

client.once('ready', async () => {
    console.log(`تم تسجيل الدخول كـ ${client.user.tag}`);
    
    try {
        const link = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
        console.log('رابط دعوة البوت:', link);
    } catch (error) {
        console.error('خطأ في إنشاء رابط الدعوة:', error);
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isCommand()) {
            console.log(`تم استلام أمر: ${interaction.commandName}`);

            switch (interaction.commandName) {
                case 'ping':
                    await interaction.reply({ content: 'Pong! 🏓', ephemeral: true });
                    break;

                case 'setup':
                    // التحقق من الصلاحيات
                    if (!hasAdminRole(interaction.member)) {
                        return await interaction.reply({
                            content: 'عذراً، هذا الأمر متاح فقط للإدارة!',
                            ephemeral: true
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(config.SHOP_TITLE)
                        .setDescription('مرحباً بك في المتجر!\n\nMade by souhaib: https://guns.lol/souhaib')
                        .setImage(config.SHOP_IMAGE)
                        .setColor(config.EMBED_COLOR)
                        .setTimestamp()
                        .setFooter({ text: 'Made by souhaib' });

                    const selectMenu = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('shop_select')
                                .setPlaceholder('اختر منتجاً')
                                .addOptions([
                                    {
                                        label: 'لا توجد منتجات',
                                        description: 'لم يتم إضافة أي منتجات بعد',
                                        value: 'no_products'
                                    }
                                ])
                        );

                    await interaction.reply({
                        embeds: [embed],
                        components: [selectMenu]
                    });
                    break;

                case 'add':
                    // التحقق من الصلاحيات
                    if (!hasAdminRole(interaction.member)) {
                        return await interaction.reply({
                            content: 'عذراً، هذا الأمر متاح فقط للإدارة!',
                            ephemeral: true
                        });
                    }

                    const productName = interaction.options.getString('name');
                    const productDescription = interaction.options.getString('description');
                    const productImage = interaction.options.getString('image');

                    // تخزين معلومات المنتج
                    products.set(productName, {
                        description: productDescription,
                        image: productImage
                    });

                    const messages = await interaction.channel.messages.fetch({ limit: 100 });
                    const shopMessage = messages.find(msg => 
                        msg.author.id === client.user.id && 
                        msg.embeds[0]?.title === config.SHOP_TITLE
                    );

                    if (shopMessage) {
                        const newSelectMenu = new ActionRowBuilder()
                            .addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId('shop_select')
                                    .setPlaceholder('اختر منتجاً')
                                    .addOptions(
                                        Array.from(products.entries()).map(([name, data]) => ({
                                            label: name,
                                            description: data.description.substring(0, 100),
                                            value: name
                                        }))
                                    )
                            );

                        await shopMessage.edit({ components: [newSelectMenu] });
                        await interaction.reply({
                            content: `تم إضافة المنتج "${productName}" بنجاح!`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: 'لم يتم العثور على رسالة المتجر. الرجاء استخدام أمر /setup أولاً.',
                            ephemeral: true
                        });
                    }
                    break;
            }
        }
        
        // التعامل مع اختيار المنتج من القائمة
        else if (interaction.isStringSelectMenu() && interaction.customId === 'shop_select') {
            const selectedValue = interaction.values[0];
            
            if (selectedValue === 'no_products') {
                await interaction.reply({
                    content: 'لا توجد منتجات متاحة حالياً.',
                    ephemeral: true
                });
                return;
            }

            const product = products.get(selectedValue);
            if (product) {
                const productEmbed = new EmbedBuilder()
                    .setTitle(selectedValue)
                    .setDescription(product.description)
                    .setColor(config.EMBED_COLOR)
                    .setTimestamp()
                    .setFooter({ text: 'Made by souhaib' });

                if (product.image) {
                    productEmbed.setImage(product.image);
                }

                await interaction.reply({
                    embeds: [productEmbed],
                    ephemeral: true // جعل الرد مرئي فقط للشخص الذي اختار المنتج
                });
            } else {
                await interaction.reply({
                    content: 'عذراً، لم يتم العثور على المنتج المحدد.',
                    ephemeral: true
                });
            }
        }
    } catch (error) {
        console.error('حدث خطأ:', error);
        try {
            if (!interaction.replied) {
                await interaction.reply({
                    content: 'حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.',
                    ephemeral: true
                });
            }
        } catch (e) {
            console.error('فشل في إرسال رسالة الخطأ:', e);
        }
    }
});

// تشغيل البرنامج
main(); 