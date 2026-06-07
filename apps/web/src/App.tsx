import { useEffect, useMemo, useState } from 'react'

type Product = {
  id: string
  title: string
  section: string
  image: string
  sourceUrl: string
  description: string
  momBenefit: string
  familyUse: string
  components: string[]
  tags: string[]
}

type Scenario = {
  id: string
  label: string
  title: string
  intro: string
  productIds: string[]
}

type Page = 'home' | 'catalog' | 'info'

type CatalogProduct = {
  title: string
  sourceUrl: string
  image: string
  section: string
  description: string
  forWhat: string
  components: string[]
  benefits: string[]
}

const products: Product[] = [
  {
    id: 'tentorium-plus',
    title: 'Тенториум Плюс',
    section: 'Драже',
    image: 'https://tentorium.ru/media/storage/f52/130/group-4259-1.png',
    sourceUrl: 'https://tentorium.ru/ref/2065353/product/tentorium-plius-300-g',
    description: 'Базовое драже с пыльцой, прополисом и воском для ежедневной поддержки рациона.',
    momBenefit: 'Подойдет как спокойная основа на каждый день, когда нужен мягкий тонус без сложной схемы.',
    familyUse: 'Удобный формат для семейной полки: видно состав и легко объяснить, для какой задачи продукт выбирают.',
    components: ['Пыльца', 'Прополис', 'Пчелиный воск'],
    tags: ['Ежедневная поддержка', 'Тонус', 'Иммунный сезон']
  },
  {
    id: 'apibalm-1',
    title: 'Апибальзам 1',
    section: 'Бальзамы',
    image: 'https://tentorium.ru/media/storage/45d/4dd/group-4242.png',
    sourceUrl: 'https://tentorium.ru/ref/2065353/product/apibalzam-1-100-ml',
    description: 'Масляный бальзам с прополисом, который мягко обволакивает слизистые.',
    momBenefit: 'Хорош для моментов, когда у мамы много разговоров, садик, школа, поездки и нужен комфорт для горла.',
    familyUse: 'Можно держать как продукт направленного ухода для ЛОР-зоны и полости рта.',
    components: ['Прополис', 'Пчелиный воск', 'Масляная основа'],
    tags: ['Горло', 'Полость рта', 'Комфорт']
  },
  {
    id: 'product-3',
    title: 'Продукт №3',
    section: 'Бальзамы',
    image: 'https://tentorium.ru/media/storage/c39/a73/group-4270-1.png',
    sourceUrl: 'https://tentorium.ru/ref/2065353/product/ekstrakt-propolisa-vodnyi-produkt-no-3-200-ml',
    description: 'Водный экстракт прополиса для комплексной поддержки иммунитета и пищеварения.',
    momBenefit: 'Понятная база, когда хочется одного универсального продукта для сезонной поддержки.',
    familyUse: 'Подходит для объяснения через компонент: прополис связан с защитой, восстановлением и слизистыми.',
    components: ['Прополис', 'Водная вытяжка'],
    tags: ['Иммунитет', 'Пищеварение', 'Универсально']
  },
  {
    id: 'apitok',
    title: 'Апиток',
    section: 'Медовые композиции',
    image: 'https://tentorium.ru/media/storage/a7b/36b/apitok-300.webp',
    sourceUrl: 'https://tentorium.ru/ref/2065353/product/apitok-300-g',
    description: 'Медовая композиция с маточным молочком и прополисом в мягком питательном формате.',
    momBenefit: 'Для периода усталости, когда хочется теплого продукта с медовой основой и ощущением заботы.',
    familyUse: 'Можно представить как мягкий медовый формат для взрослых, где вкус помогает соблюдать привычный ритуал.',
    components: ['Мед', 'Маточное молочко', 'Прополис'],
    tags: ['Ресурс мамы', 'Баланс', 'Медовая композиция']
  },
  {
    id: 'extra-lor',
    title: 'Экстра-Лор',
    section: 'Драже',
    image: 'https://tentorium.ru/media/storage/fbc/e73/group-4258-1.png',
    sourceUrl: 'https://tentorium.ru/ref/2065353/product/ekstra-lor-300-g',
    description: 'Драже с медом, прополисом, пыльцой и растительными экстрактами для ЛОР-направления.',
    momBenefit: 'Уместен в сезон простуд, когда важно быстро понять, что взять для горла и дыхательного комфорта.',
    familyUse: 'Легко поставить в набор рядом с базовым драже и продуктом с прополисом.',
    components: ['Мед', 'Прополис', 'Пыльца', 'Растительные экстракты'],
    tags: ['ЛОР', 'Сезон простуд', 'Дыхание']
  },
  {
    id: 'api-spira',
    title: 'Апи-Спира',
    section: 'Драже',
    image: 'https://tentorium.ru/media/storage/a31/4ed/group-4261-1.png',
    sourceUrl: 'https://tentorium.ru/ref/2065353/product/api-spira-300-g',
    description: 'Сочетание пыльцы, меда, прополиса и спирулины для активного ежедневного рациона.',
    momBenefit: 'Для тех дней, когда мама держит дом, работу, кружки и хочет добавить в рацион больше питательной поддержки.',
    familyUse: 'Хорошо смотрится в разделе про активность, минералы и общий тонус.',
    components: ['Пыльца', 'Мед', 'Прополис', 'Спирулина'],
    tags: ['Активность', 'Рацион', 'Минералы']
  }
]

const scenarios: Scenario[] = [
  {
    id: 'season',
    label: 'Сезон простуд',
    title: 'Когда садик, школа и погода проверяют семью',
    intro: 'Собираем полку без паники: базовая поддержка, комфорт для горла и понятный продукт с прополисом.',
    productIds: ['extra-lor', 'product-3', 'tentorium-plus']
  },
  {
    id: 'voice',
    label: 'Горло и голос',
    title: 'Когда мама много говорит, ведет дела и отвечает за всех',
    intro: 'Фокус на слизистые, полость рта и ощущение мягкого обволакивания.',
    productIds: ['apibalm-1', 'extra-lor', 'product-3']
  },
  {
    id: 'energy',
    label: 'Ресурс мамы',
    title: 'Когда хочется сил, ясности и теплого ритуала для себя',
    intro: 'Здесь продукты не про героизм, а про ежедневную заботу, питание и восстановление.',
    productIds: ['apitok', 'api-spira', 'tentorium-plus']
  },
  {
    id: 'tummy',
    label: 'Питание и животик',
    title: 'Когда хочется мягко поддержать рацион семьи',
    intro: 'Выбираем продукты с прополисом, пыльцой и спирулиной для понятного ежедневного меню.',
    productIds: ['product-3', 'api-spira', 'tentorium-plus']
  },
  {
    id: 'beauty',
    label: 'Красота и уход',
    title: 'Когда забота о себе должна быть простой и красивой',
    intro: 'Медовые композиции и апикомпоненты можно подать как уютный ритуал для мамы.',
    productIds: ['apitok', 'api-spira', 'apibalm-1']
  }
]

const beeComponents = [
  ['Мед', 'Мягкая питательная база, вкус и ощущение теплого домашнего ритуала.'],
  ['Прополис', 'Компонент, который в каталоге чаще всего связан с защитой, слизистыми и восстановлением.'],
  ['Пыльца', 'Источник аминокислот, ферментов и микроэлементов для ежедневной поддержки.'],
  ['Маточное молочко', 'Ценный апикомпонент для продуктов тонуса, баланса и комплексной поддержки.']
]

const faq = [
  {
    question: 'Это лекарство или БАД?',
    answer: 'Это не лекарство. Часть продуктов относится к пищевой продукции или БАД, поэтому на странице важно смотреть описание, состав, назначение и инструкцию конкретного продукта.'
  },
  {
    question: 'Можно ли детям?',
    answer: 'Можно рассматривать только те продукты, где это разрешено инструкцией по возрасту. Для ребенка лучше начинать с консультации специалиста, особенно если есть аллергии или хронические состояния.'
  },
  {
    question: 'Можно беременным и при ГВ?',
    answer: 'Во время беременности и грудного вскармливания любые продукты пчеловодства лучше согласовать с врачом. Это спокойнее и безопаснее, потому что реакция организма индивидуальна.'
  },
  {
    question: 'Что делать при аллергии на мед?',
    answer: 'При аллергии на мед, прополис, пыльцу или другие продукты пчеловодства такие средства не выбирают без консультации врача. Важно внимательно смотреть состав.'
  },
  {
    question: 'Как выбрать первый продукт?',
    answer: 'Проще идти от задачи: сезон простуд, горло, энергия мамы, питание или уход. Начинают с одного продукта, смотрят состав и инструкцию, а потом добавляют остальные при необходимости.'
  }
]

const infoTopics = [
  {
    title: 'Сезон простуд',
    text: 'Поддержка рациона, горла и общего самочувствия в периоды, когда дети ходят в садик, школу и кружки.',
    items: ['Прополис', 'Мед', 'Пыльца', 'ЛОР-направление']
  },
  {
    title: 'Энергия и усталость',
    text: 'Мягкие продукты для ежедневного ритма мамы: питание, тонус, восстановление после насыщенного дня.',
    items: ['Медовые композиции', 'Маточное молочко', 'Пыльца']
  },
  {
    title: 'Пищеварение и рацион',
    text: 'Форматы, которые можно рассматривать как часть привычного питания и поддержки микрофлоры.',
    items: ['Прополис', 'Спирулина', 'Пробиотики', 'Пищевые продукты']
  },
  {
    title: 'Кожа, массаж, суставы',
    text: 'Наружные средства с воском, прополисом, растительными экстрактами и маслами для ухода и массажа.',
    items: ['Пчелиный воск', 'Прополис', 'Масла', 'Кремы']
  }
]

const componentInfo = [
  ['Мед', 'Питательная основа и мягкий вкус. Важно учитывать индивидуальную реакцию и возраст.'],
  ['Прополис', 'Часто встречается в продуктах для сезонной поддержки, горла, слизистых и наружного ухода.'],
  ['Пыльца', 'Источник природных микроэлементов и аминокислот, используется в продуктах для тонуса.'],
  ['Маточное молочко', 'Компонент для продуктов, связанных с ресурсом, балансом и поддержкой рациона.'],
  ['Пчелиный воск', 'Используется в драже, кремах, бальзамах и наружных средствах как природная основа.'],
  ['Перга', 'Пчелиный продукт, который чаще связывают с питательной поддержкой и восстановлением.']
]

const sourceLinks = [
  {
    title: 'Активные компоненты',
    text: 'Справочник компонентов Тенториум: мед, прополис, пыльца, перга, маточное молочко, воск и другие.',
    url: 'https://tentorium.ru/infotorium/components/'
  },
  {
    title: 'Лекция “Мед. Медовая коллекция Тенториум”',
    text: 'Материал Академии Тенториум про виды меда, состав, хранение и полезные свойства.',
    url: 'https://tentorium.ru/edu/course/zanyatie-1-myod-medovaya-kollektsiya-tentorium/'
  }
]

export function App() {
  const [page, setPage] = useState<Page>('home')
  const [activeScenarioId, setActiveScenarioId] = useState(scenarios[0].id)
  const [activeProductId, setActiveProductId] = useState(products[0].id)
  const [openFaq, setOpenFaq] = useState(0)
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogSection, setCatalogSection] = useState('Все')

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0],
    [activeScenarioId]
  )
  const recommendedProducts = useMemo(
    () => products.filter((product) => activeScenario.productIds.includes(product.id)),
    [activeScenario]
  )
  const activeProduct = products.find((product) => product.id === activeProductId) ?? products[0]
  const catalogSections = useMemo(
    () => ['Все', ...Array.from(new Set(catalogProducts.map((product) => product.section))).sort()],
    [catalogProducts]
  )
  const visibleCatalogProducts = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase()

    return catalogProducts.filter((product) => {
      const matchesSection = catalogSection === 'Все' || product.section === catalogSection
      const searchText = [
        product.title,
        product.section,
        product.description,
        product.forWhat,
        ...product.components,
        ...product.benefits
      ].join(' ').toLowerCase()

      return matchesSection && (!query || searchText.includes(query))
    })
  }, [catalogProducts, catalogQuery, catalogSection])

  useEffect(() => {
    let isMounted = true

    fetch('/tentorium-catalog.json')
      .then((response) => response.json())
      .then((body: { products?: CatalogProduct[] }) => {
        if (isMounted) {
          setCatalogProducts(body.products ?? [])
        }
      })
      .catch(() => {
        if (isMounted) {
          setCatalogProducts([])
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const showHomeSection = (sectionId: string) => {
    setPage('home')
    window.requestAnimationFrame(() => {
      const target = document.getElementById(sectionId)
      if (!target) {
        return
      }

      target.scrollIntoView({ behavior: 'smooth' })
    })
  }

  const brandLogo = (
    <span className="brand-copy">
      <span className="brand-title">Пчелиный Дар</span>
      <span className="brand-subtitle">натуральная забота</span>
    </span>
  )

  if (page === 'catalog') {
    return (
      <main className="mom-page">
        <header className="site-header">
          <button className="brand brand-button" type="button" onClick={() => setPage('home')} aria-label="На главную">
            {brandLogo}
          </button>
          <nav className="nav-links" aria-label="Разделы сайта">
            <button type="button" onClick={() => showHomeSection('choose')}>Подбор</button>
            <button className="is-active" type="button" onClick={() => setPage('catalog')}>Каталог</button>
            <button type="button" onClick={() => setPage('info')}>Полезная информация</button>
            <button type="button" onClick={() => showHomeSection('faq')}>Вопросы</button>
          </nav>
        </header>

        <section className="full-catalog-page">
          <div className="catalog-hero">
            <p className="eyebrow">Полный каталог</p>
            <h1>Каталог Пчелиный Дар</h1>
            <p>
              Здесь собраны продукты с названием, направлением, кратким описанием и ссылкой
              на оригинальную страницу товара.
            </p>
          </div>

          <div className="catalog-toolbar">
            <label>
              <span>Поиск</span>
              <input
                type="search"
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Название, компонент или задача"
              />
            </label>
            <label>
              <span>Раздел</span>
              <select value={catalogSection} onChange={(event) => setCatalogSection(event.target.value)}>
                {catalogSections.map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </label>
          </div>

          <section className="support-card">
            <div>
              <p className="eyebrow">Перед покупкой</p>
              <h2>Можно уточнить дозировки и подбор</h2>
              <p>
                Напишите в VK, если нужно подобрать продукт по возрасту, ситуации, ограничениям
                или задать вопрос по применению.
              </p>
            </div>
            <a className="support-link" href="https://vk.ru/im/convo/68327009?tab=all" target="_blank" rel="noreferrer">
              Написать в VK
            </a>
          </section>

          <div className="full-catalog-grid">
            {visibleCatalogProducts.map((product) => (
              <article className="catalog-product-card" key={product.sourceUrl}>
                <div className="catalog-product-image">
                  {product.image ? <img src={product.image} alt={product.title} loading="lazy" /> : <span>Нет фото</span>}
                </div>
                <div className="catalog-product-copy">
                  <span className="section-pill">{product.section}</span>
                  <h2>{product.title}</h2>
                  <p>{product.description}</p>
                  {product.forWhat ? (
                    <>
                      <strong className="product-purpose">Направление:</strong>
                      <p>{product.forWhat}</p>
                    </>
                  ) : null}
                  <div className="tag-row">
                    {product.components.map((component) => (
                      <span key={component}>{component}</span>
                    ))}
                  </div>
                  <a className="catalog-link" href={product.sourceUrl} target="_blank" rel="noreferrer">
                    Купить
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    )
  }

  if (page === 'info') {
    return (
      <main className="mom-page">
        <header className="site-header">
          <button className="brand brand-button" type="button" onClick={() => setPage('home')} aria-label="На главную">
            {brandLogo}
          </button>
          <nav className="nav-links" aria-label="Разделы сайта">
            <button type="button" onClick={() => showHomeSection('choose')}>Подбор</button>
            <button type="button" onClick={() => setPage('catalog')}>Каталог</button>
            <button className="is-active" type="button" onClick={() => setPage('info')}>Полезная информация</button>
            <button type="button" onClick={() => showHomeSection('faq')}>Вопросы</button>
          </nav>
        </header>

        <section className="info-page">
          <div className="info-hero">
            <p className="eyebrow">Справочник для мам</p>
            <h1>Полезная информация</h1>
            <p>
              Коротко и понятно: какие компоненты встречаются в продуктах пчеловодства, когда их обычно
              рассматривают и на что обратить внимание перед покупкой.
            </p>
          </div>

          <section className="info-warning">
            <h2>Важно</h2>
            <p>
              Продукты пчеловодства не заменяют лечение и консультацию врача. При аллергии, беременности,
              грудном вскармливании, хронических заболеваниях и выборе продукта для ребенка нужно смотреть
              инструкцию и советоваться со специалистом.
            </p>
          </section>

          <section className="info-section">
            <div className="section-heading">
              <p className="eyebrow">Когда может пригодиться</p>
              <h2>Подбор по жизненным ситуациям</h2>
            </div>
            <div className="info-topic-grid">
              {infoTopics.map((topic) => (
                <article key={topic.title}>
                  <h3>{topic.title}</h3>
                  <p>{topic.text}</p>
                  <div className="tag-row">
                    {topic.items.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="info-section">
            <div className="section-heading">
              <p className="eyebrow">Компоненты</p>
              <h2>Что чаще всего встречается в составе</h2>
            </div>
            <div className="component-info-grid">
              {componentInfo.map(([name, text]) => (
                <article key={name}>
                  <span>{name.slice(0, 1)}</span>
                  <h3>{name}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="info-section">
            <div className="section-heading">
              <p className="eyebrow">Детям и мамам</p>
              <h2>Как говорить об этом безопасно</h2>
            </div>
            <div className="safety-list">
              <article>
                <h3>Детям</h3>
                <p>Выбирать только продукты, где возраст разрешен инструкцией. Начинать осторожно и учитывать аллергию.</p>
              </article>
              <article>
                <h3>Беременность и ГВ</h3>
                <p>Не подбирать самостоятельно. Любые продукты пчеловодства лучше согласовать с врачом.</p>
              </article>
              <article>
                <h3>Аллергия</h3>
                <p>Мед, прополис, пыльца и другие апикомпоненты могут вызывать индивидуальную реакцию.</p>
              </article>
            </div>
          </section>

          <section className="info-section">
            <div className="section-heading">
              <p className="eyebrow">Источники</p>
              <h2>Где почитать подробнее</h2>
            </div>
            <div className="source-grid">
              {sourceLinks.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  <h3>{source.title}</h3>
                  <p>{source.text}</p>
                  <span>Открыть материал</span>
                </a>
              ))}
            </div>
          </section>
        </section>
      </main>
    )
  }

  return (
    <main className="mom-page">
      <header className="site-header">
        <button className="brand brand-button" type="button" onClick={() => showHomeSection('top')} aria-label="На главную">
          {brandLogo}
        </button>
        <nav className="nav-links" aria-label="Разделы сайта">
          <button type="button" onClick={() => showHomeSection('choose')}>Подбор</button>
          <button type="button" onClick={() => setPage('catalog')}>Каталог</button>
          <button type="button" onClick={() => setPage('info')}>Полезная информация</button>
          <button type="button" onClick={() => showHomeSection('faq')}>Вопросы</button>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Пчелиный Дар</p>
          <h1>Пчелиный Дар для мам и всей семьи</h1>
          <p>
            Понятные продукты пчеловодства, польза простым языком и интерактивный подбор
            под ситуацию дома.
          </p>
          <div className="hero-actions">
            <a href="#choose" className="primary-link">Подобрать набор</a>
            <a href="#catalog" className="secondary-link">Смотреть продукты</a>
          </div>
        </div>
        <div className="hero-showcase" aria-label="Пример продукта">
          <img src="https://tentorium.ru/media/storage/f52/130/group-4259-1.png" alt="Тенториум Плюс" />
        </div>
      </section>

      <section className="trust-strip" aria-label="Направления заботы">
        <article>
          <span>01</span>
          <h2>Сезон</h2>
          <p>Что держать дома, когда дети ходят в садик, школу и кружки.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Горло</h2>
          <p>ЛОР-направление, голос, слизистые и комфорт полости рта.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Ресурс</h2>
          <p>Поддержка мамы, питание, тонус и спокойный ежедневный ритуал.</p>
        </article>
        <article>
          <span>04</span>
          <h2>Уход</h2>
          <p>Красивые медовые композиции и компоненты с понятной пользой.</p>
        </article>
      </section>

      <section className="support-card">
        <div>
          <p className="eyebrow">Поддержка</p>
          <h2>Спросить перед покупкой</h2>
          <p>
            Можно написать в VK и уточнить дозировки, возраст, состав, ограничения или подобрать
            продукт под вашу ситуацию.
          </p>
        </div>
        <a className="support-link" href="https://vk.ru/im/convo/68327009?tab=all" target="_blank" rel="noreferrer">
          Написать в VK
        </a>
      </section>

      <section className="chooser-section" id="choose">
        <div className="section-heading">
          <p className="eyebrow">Интерактивный подбор</p>
          <h2>Выберите, что сейчас важнее для семьи</h2>
        </div>

        <div className="chooser-grid">
          <div className="scenario-tabs" role="tablist" aria-label="Ситуации">
            {scenarios.map((scenario) => (
              <button
                className={scenario.id === activeScenarioId ? 'scenario-button is-active' : 'scenario-button'}
                data-testid={`scenario-${scenario.id}`}
                key={scenario.id}
                type="button"
                role="tab"
                aria-selected={scenario.id === activeScenarioId}
                onClick={() => {
                  setActiveScenarioId(scenario.id)
                  setActiveProductId(scenario.productIds[0])
                }}
              >
                {scenario.label}
              </button>
            ))}
          </div>

          <article className="scenario-panel">
            <span className="panel-number">0{scenarios.findIndex((item) => item.id === activeScenario.id) + 1}</span>
            <h3>{activeScenario.title}</h3>
            <p>{activeScenario.intro}</p>
          </article>

          <div className="recommended-box" aria-label="Рекомендованные продукты">
            <p className="box-title">Подойдут в первую очередь</p>
            {recommendedProducts.map((product) => (
              <button
                className={product.id === activeProductId ? 'recommendation is-active' : 'recommendation'}
                data-testid={`recommendation-${product.id}`}
                key={product.id}
                type="button"
                onClick={() => setActiveProductId(product.id)}
              >
                <img src={product.image} alt="" />
                <span>
                  <b>{product.title}</b>
                  <small>{product.section}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="catalog-section" id="catalog">
        <div className="section-heading">
          <p className="eyebrow">Подбор продуктов</p>
          <h2>Продукты с понятным объяснением “для чего”</h2>
        </div>

        <div className="catalog-layout">
          <div className="product-grid">
            {products.map((product) => (
              <button
                className={product.id === activeProductId ? 'product-card is-active' : 'product-card'}
                data-testid={`product-${product.id}`}
                key={product.id}
                type="button"
                onClick={() => setActiveProductId(product.id)}
              >
                <span className="section-pill">{product.section}</span>
                <h3>{product.title}</h3>
                <div className="product-image" data-product-id={product.id}>
                  <img src={product.image} alt={product.title} />
                </div>
                <strong className="product-purpose">Для чего</strong>
                <p>{product.description}</p>
              </button>
            ))}
          </div>

          <aside className="detail-panel" aria-live="polite">
            <p className="eyebrow">Детали продукта</p>
            <h3>{activeProduct.title}</h3>
            <div className="detail-image" data-product-id={activeProduct.id}>
              <img src={activeProduct.image} alt={activeProduct.title} />
            </div>
            <strong className="product-purpose">Для чего</strong>
            <p>{activeProduct.description}</p>
            <div>
              <h4>Для мамы</h4>
              <p>{activeProduct.momBenefit}</p>
            </div>
            <div>
              <h4>Для семьи</h4>
              <p>{activeProduct.familyUse}</p>
            </div>
            <div className="tag-row">
              {activeProduct.components.map((component) => (
                <span key={component}>{component}</span>
              ))}
            </div>
            <div className="benefit-row">
              {activeProduct.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <a className="catalog-link detail-buy-link" href={activeProduct.sourceUrl} target="_blank" rel="noreferrer">
              Купить
            </a>
          </aside>
        </div>
      </section>

      <section className="components-section">
        <div className="section-heading">
          <p className="eyebrow">Польза компонентов</p>
          <h2>Объясняем состав без сложных терминов</h2>
        </div>
        <div className="component-board">
          {beeComponents.map(([name, text]) => (
            <article key={name}>
              <span>{name.slice(0, 1)}</span>
              <h3>{name}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div className="section-heading">
          <p className="eyebrow">Для спокойной покупки</p>
          <h2>Вопросы, которые обычно задают мамы</h2>
        </div>
        <div className="faq-list">
          {faq.map((item, index) => (
            <article className="faq-item" key={item.question}>
              <button
                data-testid={`faq-${index}`}
                type="button"
                aria-expanded={openFaq === index}
                onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
              >
                <span>{item.question}</span>
                <b>{openFaq === index ? '−' : '+'}</b>
              </button>
              {openFaq === index && <p>{item.answer}</p>}
            </article>
          ))}
        </div>
      </section>

    </main>
  )
}
