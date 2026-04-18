import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const resources = [
  // --- COMMUNICATION ---
  { skill: 'communication', type: 'book',    title: 'Ненасильственное общение',                        author: 'Маршалл Розенберг',   description: 'Метод общения, основанный на сострадании и уважении к чувствам собеседника. Учит выражать потребности без обвинений.' },
  { skill: 'communication', type: 'book',    title: 'Как завоёвывать друзей и оказывать влияние на людей', author: 'Дейл Карнеги',      description: 'Классика межличностной коммуникации. Практические принципы построения отношений и убеждения.' },
  { skill: 'communication', type: 'book',    title: 'Договориться можно обо всём',                     author: 'Гэвин Кеннеди',       description: 'Практическое руководство по переговорам: как добиваться своего, не уступая в главном.' },
  { skill: 'communication', type: 'article', title: 'Активное слушание: техники и приёмы',             author: 'Harvard Business Review', description: 'Практические советы по развитию навыка активного слушания в деловом общении.' },
  { skill: 'communication', type: 'article', title: 'Как давать обратную связь, которая работает',     author: 'HBR Россия',          description: 'Разбор SBI-модели обратной связи и типичных ошибок при её передаче.' },
  { skill: 'communication', type: 'video',   title: 'How to speak so that people want to listen',      author: 'Julian Treasure (TED)', description: 'Популярный TED-talk о голосе, интонации и семи смертных грехах общения.' },
  { skill: 'communication', type: 'video',   title: '10 способов улучшить свою речь',                  author: 'Радислав Гандапас',    description: 'Практический разбор ошибок публичных выступлений и способов их устранить.' },
  { skill: 'communication', type: 'course',  title: 'Публичные выступления и презентации',             author: 'Coursera / НИУ ВШЭ',  description: 'Онлайн-курс по ораторскому мастерству и деловой письменной коммуникации.' },

  // --- LEADERSHIP ---
  { skill: 'leadership', type: 'book',    title: 'Лидер без титула',                              author: 'Робин Шарма',          description: 'О том, что лидерство — это выбор, а не должность. Философия вовлечённости и личной ответственности.' },
  { skill: 'leadership', type: 'book',    title: 'От хорошего к великому',                        author: 'Джим Коллинз',         description: 'Исследование факторов, которые отличают великие компании от просто хороших.' },
  { skill: 'leadership', type: 'book',    title: 'Пять пороков команды',                          author: 'Патрик Ленсиони',      description: 'Бизнес-притча о доверии, конфликтах и ответственности в командной работе.' },
  { skill: 'leadership', type: 'article', title: 'Что на самом деле делают лидеры',               author: 'John P. Kotter (HBR)', description: 'Классическая статья о разнице между менеджментом и лидерством.' },
  { skill: 'leadership', type: 'article', title: 'Стили лидерства: когда применять каждый',       author: 'Daniel Goleman (HBR)', description: 'Разбор шести стилей ситуационного лидерства и их влияния на климат в команде.' },
  { skill: 'leadership', type: 'video',   title: 'How great leaders inspire action',               author: 'Simon Sinek (TED)',     description: 'Концепция «Начни с вопроса "Почему?"» — один из самых просматриваемых TED-talks.' },
  { skill: 'leadership', type: 'video',   title: 'Что делает нас хорошими лидерами',               author: 'Роуан Гибсон',         description: 'Разбор ключевых компетенций современного лидера в условиях неопределённости.' },
  { skill: 'leadership', type: 'course',  title: 'Лидерство и эмоциональный интеллект',           author: 'Skillbox',             description: 'Практический курс по развитию лидерских качеств и управлению командой.' },

  // --- SELF_ORGANIZATION ---
  { skill: 'self_organization', type: 'book',    title: 'Getting Things Done (GTD)',              author: 'Дэвид Аллен',          description: 'Система управления задачами, снижающая когнитивную нагрузку и помогающая доводить дела до конца.' },
  { skill: 'self_organization', type: 'book',    title: 'Атомные привычки',                       author: 'Джеймс Клир',          description: 'Как формировать полезные привычки с помощью небольших ежедневных изменений.' },
  { skill: 'self_organization', type: 'book',    title: 'Глубокая работа',                        author: 'Кэл Ньюпорт',          description: 'Почему способность к концентрации становится суперсилой и как её развить.' },
  { skill: 'self_organization', type: 'article', title: 'Метод Помодоро: полное руководство',     author: 'Todoist Blog',         description: 'Техника временных блоков для повышения продуктивности и борьбы с прокрастинацией.' },
  { skill: 'self_organization', type: 'article', title: 'Матрица Эйзенхауэра на практике',        author: 'Asana Blog',           description: 'Как расставлять приоритеты между срочными и важными задачами.' },
  { skill: 'self_organization', type: 'video',   title: 'Внутри разума прокрастинатора',          author: 'Tim Urban (TED)',      description: 'Юморной и точный разбор механизмов откладывания дел на потом.' },
  { skill: 'self_organization', type: 'video',   title: 'Как перестать откладывать на потом',     author: 'Mel Robbins',          description: 'Правило пяти секунд и другие техники немедленного действия.' },
  { skill: 'self_organization', type: 'course',  title: 'Управление временем и продуктивность',  author: 'Нетология',            description: 'Практические инструменты планирования, делегирования и фокусировки.' },

  // --- EMPATHY ---
  { skill: 'empathy', type: 'book',    title: 'Эмоциональный интеллект',                        author: 'Дэниел Гоулман',       description: 'Фундаментальная книга о самосознании, саморегуляции и понимании других людей.' },
  { skill: 'empathy', type: 'book',    title: 'Дары несовершенства',                             author: 'Брене Браун',          description: 'О уязвимости, принятии и подлинных связях с людьми как основе эмпатии.' },
  { skill: 'empathy', type: 'book',    title: 'Я слышу вас насквозь',                            author: 'Марк Гоулстон',        description: 'Техники эффективного слушания и считывания эмоций собеседника.' },
  { skill: 'empathy', type: 'article', title: 'Эмпатия vs симпатия: в чём разница',              author: 'Psychology Today',     description: 'Объяснение концепции эмпатии, её видов и роли в построении доверия.' },
  { skill: 'empathy', type: 'article', title: 'Как развить эмоциональный интеллект на работе',  author: 'HBR Россия',           description: 'Четыре компонента EQ по Гоулману и упражнения для их развития.' },
  { skill: 'empathy', type: 'video',   title: 'Сила уязвимости',                                 author: 'Brené Brown (TED)',    description: 'Один из самых просматриваемых TED-talks — об эмоциональной связи и смелости быть собой.' },
  { skill: 'empathy', type: 'video',   title: 'Эмпатия: почему она важна',                       author: 'Roman Krznaric',       description: 'Разбор шести привычек высокоэмпатичных людей.' },
  { skill: 'empathy', type: 'course',  title: 'Эмоциональный интеллект на практике',             author: 'GeekBrains',           description: 'Развитие навыков распознавания, понимания и регуляции эмоций.' },

  // --- CRITICAL_THINKING ---
  { skill: 'critical_thinking', type: 'book',    title: 'Думай медленно… решай быстро',          author: 'Даниэль Канеман',      description: 'Два режима мышления: быстрое интуитивное и медленное аналитическое. Базовая книга по когнитивным искажениям.' },
  { skill: 'critical_thinking', type: 'book',    title: 'Искусство мыслить ясно',                author: 'Рольф Добелли',        description: '99 систематических ошибок мышления, которые мы совершаем каждый день.' },
  { skill: 'critical_thinking', type: 'book',    title: 'Критическое мышление',                  author: 'Том Чатфилд',          description: 'Практическое руководство по анализу аргументов, оценке источников и построению логических цепочек.' },
  { skill: 'critical_thinking', type: 'article', title: 'Как развить критическое мышление',      author: 'Нож',                  description: 'Практические упражнения для оценки информации, выявления манипуляций и построения аргументов.' },
  { skill: 'critical_thinking', type: 'article', title: 'Метод Сократа: задавай правильные вопросы', author: 'Farnam Street',    description: 'Как сократовский диалог помогает проверять идеи и находить слабые места в рассуждениях.' },
  { skill: 'critical_thinking', type: 'video',   title: 'Как мыслить, а не что думать',          author: 'Maj. Shayne Lundholm (TED)', description: 'О важности самостоятельного мышления и противостояния информационному шуму.' },
  { skill: 'critical_thinking', type: 'video',   title: 'Наука убеждения',                       author: 'Robert Cialdini',      description: 'Шесть принципов влияния и как не поддаваться манипуляциям.' },
  { skill: 'critical_thinking', type: 'course',  title: 'Критическое мышление и принятие решений', author: 'Stepik',             description: 'Логика, аргументация, анализ данных и работа с когнитивными искажениями.' },
] as const;

async function main() {
  console.log('Seeding resources...');
  for (const r of resources) {
    await prisma.resource.create({ data: r as any });
  }
  console.log(`✅ Added ${resources.length} resources`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
