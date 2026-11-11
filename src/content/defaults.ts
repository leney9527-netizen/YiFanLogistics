import type { Localized } from "@/lib/types";

export type CopyBlock = { title: Localized; body: Localized };

export const defaultServices: CopyBlock[] = [
  {
    title: { zh: "整柜海运报价", en: "FCL ocean quotations", fr: "Cotation maritime FCL" },
    body: {
      zh: "网站目前提供中国至西非整柜海运的公开销售价查询。首批起运港为广州南沙和宁波，首批目的港为阿比让和特马。港口、船公司和费用都可以在后台继续增加。",
      en: "The site currently quotes published FCL ocean freight from China to West Africa. The first load ports are Guangzhou Nansha and Ningbo. The first discharge ports are Abidjan and Tema. Ports, carriers and charges can be added in the admin.",
      fr: "Le site propose actuellement les tarifs FCL publiés de la Chine vers l'Afrique de l'Ouest. Les premiers ports de chargement sont Nansha (Guangzhou) et Ningbo. Les premiers ports de déchargement sont Abidjan et Tema. Les ports, compagnies et frais peuvent être ajoutés dans l'administration.",
    },
  },
  {
    title: { zh: "比价与费用估算", en: "Comparison and cost estimate", fr: "Comparaison et estimation" },
    body: {
      zh: "查询结果按已审核、已发布且仍在有效期内的销售价展示。海运费按柜量和单价在服务端计算。不同币种先分别合计，再按已记录的汇率做参考折算。",
      en: "Results show sell rates that are reviewed, published and still valid. Ocean freight is calculated on the server from the unit rate and the number of containers. Each currency is subtotalled first. A reference conversion uses a recorded exchange rate.",
      fr: "Les résultats affichent les prix de vente vérifiés, publiés et encore valides. Le fret maritime est calculé côté serveur à partir du prix unitaire et du nombre de conteneurs. Chaque devise est sous-totalisée. Une conversion de référence utilise un taux enregistré.",
    },
  },
  {
    title: { zh: "尚未提供的服务", en: "Not offered in this version", fr: "Hors de cette version" },
    body: {
      zh: "拼箱、空运、在线支付和货物跟踪尚未开通。没有发布规则的本地费用会显示为待确认或另询，不会被当成 0 元，也不会被称做全包价。",
      en: "LCL, air freight, online payment and cargo tracking are not available yet. A local charge without a published rule is shown as unconfirmed or on request. It is not treated as zero and the result is not called an all-in price.",
      fr: "Le groupage, le fret aérien, le paiement en ligne et le suivi de cargaison ne sont pas encore disponibles. Un frais local sans règle publiée est indiqué comme à confirmer ou sur demande. Il n'est pas traité comme zéro et le résultat n'est pas présenté comme un prix tout compris.",
    },
  },
];

export const defaultFaqs: { category: "rates" | "quotes" | "account"; question: Localized; body: Localized }[] = [
  {
    category: "rates",
    question: { zh: "价格从哪里来？", en: "Where do the rates come from?", fr: "D'où viennent les tarifs ?" },
    body: {
      zh: "只展示后台中已审核、已发布且覆盖所选出运日期的销售价。草稿、成本和过期价格不会出现在前台。网站不编造运价。",
      en: "Only sell rates that are reviewed, published and valid for the selected shipment date are shown. Drafts, costs and expired rates stay off the public site. The site does not invent rates.",
      fr: "Seuls les prix de vente vérifiés, publiés et valides pour la date d'expédition choisie sont affichés. Les brouillons, les coûts et les tarifs expirés restent hors du site public. Le site n'invente pas de tarifs.",
    },
  },
  {
    category: "rates",
    question: { zh: "为什么有些费用是待确认？", en: "Why are some charges unconfirmed?", fr: "Pourquoi certains frais sont-ils à confirmer ?" },
    body: {
      zh: "拖车里程、敏感货、目的港清关等如果没有已确认的计费规则，就不能给出金额。这些项目显示为待确认或另询，不计入已知费用小计。",
      en: "If trucking distance, sensitive cargo or destination clearance has no confirmed rule, no amount can be given. Those items stay unconfirmed or on request and are excluded from the known-charge subtotal.",
      fr: "Sans règle confirmée pour le kilométrage, une cargaison sensible ou le dédouanement à destination, aucun montant ne peut être indiqué. Ces postes restent à confirmer ou sur demande et sont exclus du sous-total des frais connus.",
    },
  },
  {
    category: "quotes",
    question: { zh: "保存的报价会被后来的改价覆盖吗？", en: "Can a later price change overwrite a saved quote?", fr: "Une modification ultérieure écrase-t-elle un devis enregistré ?" },
    body: {
      zh: "不会。保存报价时会冻结价格、费用、汇率和条款。之后的改价只影响新的查询。如果原运价过期或下架，已保存的报价仍可查看，并会提示重新核价。",
      en: "No. Saving a quote freezes the rates, charges, exchange rate and terms. Later changes affect only new searches. If the original rate expires, the saved quote remains visible and is marked for review.",
      fr: "Non. L'enregistrement fige les prix, les frais, le taux de change et les conditions. Les changements ultérieurs ne concernent que les nouvelles recherches. Si le tarif d'origine expire, le devis enregistré reste visible et signalé pour révision.",
    },
  },
  {
    category: "account",
    question: { zh: "注册邮箱需要验证吗？", en: "Does registration verify the email address?", fr: "L'inscription vérifie-t-elle l'adresse e-mail ?" },
    body: {
      zh: "不需要。邮箱只作为登录标识，不证明您拥有该邮箱，也不能用来自动找回密码。忘记密码时，请通过页面上的联系方式人工核验。",
      en: "No. The email is only a sign-in identifier. It does not prove that you control the mailbox and it cannot be used for automatic password recovery. If you forget the password, contact the company through the details on this site.",
      fr: "Non. L'e-mail sert seulement d'identifiant de connexion. Il ne prouve pas que vous contrôlez la boîte et ne permet pas une récupération automatique du mot de passe. En cas d'oubli, contactez l'entreprise via les coordonnées du site.",
    },
  },
];

export const defaultTerms: CopyBlock[] = [
  {
    title: { zh: "报价条件", en: "Quotation conditions", fr: "Conditions de cotation" },
    body: {
      zh: "页面金额来自生成时已发布的销售价和费用规则，并由服务端重新计算。它不是运输合同。舱位、船期和承运条件仍需船公司和本公司确认。标为参考的航程、截关和开船时间不是已确认船期。",
      en: "Amounts come from the sell rates and charge rules published at the time of calculation, and they are recalculated on the server. This is not a contract of carriage. Space, the schedule and carrier acceptance still need confirmation. Transit time, cut-off and departure marked as reference are not a confirmed schedule.",
      fr: "Les montants proviennent des prix de vente et des règles de frais publiés au moment du calcul, puis sont recalculés côté serveur. Ceci n'est pas un contrat de transport. L'espace, l'horaire et l'acceptation par la compagnie restent à confirmer. Un transit, une clôture ou un départ marqué comme référence n'est pas un horaire confirmé.",
    },
  },
  {
    title: { zh: "不含项目与汇率", en: "Excluded items and exchange rates", fr: "Éléments exclus et taux de change" },
    body: {
      zh: "未确认项目不按 0 元计算。费用不完整时，合计称为已知费用小计，而不是全包价。参考折算会写明汇率、来源和更新时间，不改变各币种的应付分项。汇率不会因为切换语言而改变。",
      en: "Unconfirmed items are not priced at zero. When the calculation is incomplete, the sum is a subtotal of known charges, not an all-in price. A reference conversion shows the rate, its source and its update time. It does not replace the amount in each currency. Changing language does not change the quote currency.",
      fr: "Les postes non confirmés ne sont pas valorisés à zéro. Lorsque le calcul est incomplet, la somme est un sous-total des frais connus, et non un prix tout compris. Une conversion de référence indique le taux, sa source et sa date de mise à jour. Elle ne remplace pas le montant de chaque devise. Changer de langue ne change pas la devise du devis.",
    },
  },
];

export const defaultCompany = {
  name: { zh: "一帆物流", en: "Yifan Logistics", fr: "Yifan Logistics" } satisfies Localized,
};
