const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const outDir = path.join(__dirname, "..", "html", "images");
fs.mkdirSync(outDir, { recursive: true });

const ImageMap = {
  "hero-home.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuA0ulhx_pcplbNa9X6SZH1ASrvssqa6aWXSNSYLxH09ygRIpncN_ozVGdIOBMgD6181gXkr5GyxJa6k0qytpnT5gS6dww7Wl7XQVAG2UdPMhV15iQZQOpm63R3S2bjxPPgsJqdKBhjD32XCLVapNEKSP1eJ-60_WoQzDFOBNlAy9nuIJre1gk9uqRoudBGf0Pb0EAWgVw62UPUcYCu9IkqMZHVTe8eAYC6UCFE_Ib7gUjdsJ9hirf2J",
  "home-team.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAsnin9iWEn87jCITxiWXTVUKI7EM8DnPjVQFGbjH5JbFDTZ66Q4OGw69n8N2DWR4D-DY1GdXtRFhi7aexEHF-i2f7Fi8Me6SSR5ycxglqNzaK_r-RNFRDQGTyt9kybKcAmGti8vG-bYx_DgpQT2CrnqeuOQ1wC-gzjYO2yfoEiXbLDAAEeahdBK3EDkKIJvNEIllGKlJobcn-n5NMEe3saQqtI_i5KwnUVs0QUS8K1ugS0uvVEoi7x",
  "home-architecture.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuB-fEeV4D8ytgEiYtCd4QP7B_0FGzr1jN7qtCm5-012bgv-LPpOJP4zQzzBFQs3MqwyGjUbVwGFYEnnHWUcp8e9M_hRy2ItXPJKKfSQgmJujEy5sat6jq8Bun2NzyUv-MERIQUW0iK4SfWPWy7yPNqocmHyByvxryJ_IRpBJadzzWOu_pd-1a8lvPVWnGSYt8CUmDEGLSPXDvjBpFV172lRG92AdfR-ea-voiFS4ex_cBIXGpTJvpxL",
  "home-case-fintech.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuBFeLKKH41nHwcf6KvZpIu4R-Sx7A0GC8dJBHaDou0MBdas73FkBA9U8H7wZ3S_v8DA4YzoDz66STXUELeeE1m0E8d8hzmLN4rSeSLXOzvRaVB-MI7tNd3pxKfxIW392jbEolE09GzFsG8UPkoTW_y7cr7pbNSk4ZpMtRU83o2yScLMouLLk4GMUTSy1EhVUnagJHHdeZvFEK2Fe-nFhm-0FPfo5I6Awzm3cuvaIm1ClM0xf-qlmOYj",
  "home-case-health.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAwf9trYlDyEuCBr_jz2LSrXir_o1sUa_nL4znNORSEOKwbPBYP-kXCBlZJ7aSO49v4c6aqsthAva_1Y0Z-OOctR1T9ucIZenrnb7A4g5VUTaVGxXX8JUWQ1oOZv0EMN-CCB9qHrE0FuP9DzxsEEr9IEjFEJfMsTmg5hkbgtFFPBcs0uo5FKeewtIAaV2ndH-Pefp4OOgr3DgpsOd4UMJl0hSoexYo_yocK2B52kksk73Hdp0iVzuGA",
  "process-hero.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCpNqum91LKRsBAYclxF29iwZiHg0vns3V4awivb7FZPyxfqJTJ3mm4cDRZ66n1I07lybY626EqDZtNAvBy8bL8vRBKV7aYDteXLHlFNsbARod2l9sejac0ejL342mlk27OIJEDAIMIdUAs7wMSzkFClPFSI_vSX96JDpOlbXyU544wrggXbKudRa9u_XeKlngL5uTzuLK18J7-dgxgpl64KP5kC_Y0TlAIXtNt0iPf3oZlQFulXJo3",
  "portfolio-1.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCQwFczboLmUV_DdlZ6urD0I4jEbruPGymLwCWRMV-b3-jyXTTparkB-GkBjBPRCcH9wG8ISNaE7jMU2zDxHh9_p2m1bG7vJNVdXzrCzXRZQNv9xIAJKr9IivtmShU0BMaTkLimVf5R0L-bhc3GxMOXrjcQuWbxVbPHvULHFxrnN5PZVWU4utznXG7CEYu6K5HTgkTN8FdyXpvEIP-iyMyxOUXNJBhord_ZiRw5mac0vrM77eH7m-Fr",
  "portfolio-2.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCCLxe3IDVJBWgpVIsnBWz-4qGKlHA3Q1b0K5ltWq-SOpT2PMUoXSt8SN7byRmKokWHkfvJ4Q4YHUjNx4SOynooaTYj39rC4wjdlPI4jRlM4vrdiPd5wOpGwMdWNkzU8VA4EgWpE41IFZ0i1re8h4lp2BtXyxeV_VkTA_sSePUMnNoS3YNTQPjskcUnlEaD3mM3fpc5MUoSECtvCSvy8v7j4n9fByi5RXgi4VSmEKQtGsJf_W7y3kA6",
  "portfolio-3.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCoqvMvQdXvYI_tYKKlHzBeLHBQcNMqLheFCmvnPFh_SK1rRIlhntpozbIVi72lkOlObk7-gC61QvZ-6TfyYy1PFXMIFdquQK-NitNxveG347wP-EAnHhDANWM1l8yjIN2sPBXwgrb8o3qxlA5DPYWjJNPKk-pXZdA1ufd6_UlmqnJEWbfQ0r0HCCm0Q5S_LvU-UFKNL1dx2Fe-1KgG_GeuNMB0b0CYK_1Tv7COecossB2IfCAvNej9",
  "portfolio-4.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuD8_AWGXjLyBTi93_ikp55nghgbzqoCRY5mLrGPT6rv_w0YzQpVCtRVt1hgC0bqVFtH_i-XOLt3FcARUvDdhrDLt2Y77VkIEHulw816Z4Zhhk6wU29_dEgWuCfSICCIuMdBSmbohseoi6nX4y0d-FioLIMlMuz6Upv2Kwrgf3u-VWPAjYy8v_2BQ4swdsuh4xDUWjDVwY3kChBQhQzc5uvA7wiCCZfb4djPEcg-mmALx8lPGo5C50Xb",
  "about-avatar-1.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCoiWaUDgn7o0WB0MGFRMobivEkzdw7rvhRBXBrZJGxHet7X6qEYNprdcq34V8GAmHc7l1nzu80wRwfIznVKwDLNdaNeLLCpK5dZdwINXuw6TrVhTjySuEQ_fBeBjzI9P88nEnfAndBTg9e8f2LbIy--W6zxtycVYzI1ThEVz94r7xaswhqJaxDN6_cMdJQxeVgC1AvJvYdZE96sEomU6O2idrNbXyqvEQbm4E0-HRRAi_79uqI_LWN",
  "about-avatar-2.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuB1sRc-6u9_FXZoZut7Hgu5e7B3iea_o5VdAmycgVFhQBqWeCgeXsrL2EbKZGrgOFhMb12nYtUh19OQb8TM7BevwUpNz1LtvJ_o5Q8aenBhH9hfMysEM29WvxF1kLXkg3E3sylmTIRRgqrfJxsyhGB0v3ScNE0NgoJ9RsxIQFVw9UznElVfRTIDBDoO-Ez13hFPX9WEj_gfHBPOaGRiv3BGorid50SmZtqdI_NbmqcxX5mef0wu_eGf",
  "about-avatar-3.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAvtfb_tkvhzSIMrE1PUzdIAgVBwzRKHIM5gV3Els7g5Q2T7Pr2i3t_dUiiVY9GzgQBjFUYaOjXt3jdqDAKtI9IxyaCYVIc_thzKng3gffmHn4euEOULvcRifftOW8Mkf2XJ96DlB67Ed3m5p7ZbgT8s9k3wUI5a5qc4V1zWZwSs1UgpRbJ6QUgPX97l7-AOwML3tyokB4Mk0AvRthAS0KBC_9niI2baopjhpJOmwGDlFwTFJTGfEWT",
  "about-hero.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCVB8MmumWeDFVCPDKe9sc59c5Q6l4wfEwQ3HY_6KXi4R6Avkij90blo1M0AUFRoNSoEWy3axodjoDFv4UM8XAijELRF-yHUTwLLDFRnNh3my34nTi5CNWHvAcfP4WXDIHl4vbq7QTFLvjQtioZ5y-5E9nyodgXxVQxuAMBJuxjrN-FqhCCRO75O2dlBfdLJVF_xPBTTnlmJ6eHM9B_g5IxFFb0t_B1ZWATKsVk01PCeFRqY9VShrkk",
  "about-team-david.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAoWKCs4d-SWwk3_qb6xxK3EE7XjfpgPEoRV4gFqz43uBH3AfwbfhjKHTIKCItdUly7ff1V0pEfR1vLp_OYVb2z_MNCP-zEdSRYym8ryUiVVNVWhkpNt0N0WP81WydKTlX2g0uHbmUKwrSqbQnHL6i4OF-WjLPd_YZ7KW2qvY27bi2GUox3B-fkMwybRtSl01U_AbTN3i5VrGTiGQasX4OZ2irKqC4ZjCP669vKNv7PfzvgHz_HVBGJ",
  "about-team-sarah.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuBGw7oALE9nY0amqC5Wx8ofPTp-mjYy-1p9yq2oOmM707_NbQnzwGZk7v5iKjQhZ6TKbf7-VUIvSA6tQ_J0sg_DhQz0Wn9LKUaUjwSPWU5Q0umRxngeeAFHbU8aYZxpSfGGwSL8Fx_BJHH0lrAs4c_CvK18VhMkaw0ZMpzmqWcKX8mb8v1QYR2UvIV51bdGpl43fjDE-aO2IW5bF5QXjzZzyKWVtp4phDdQ6K-jbVxvg7sAjTycUXd9",
  "about-team-marcus.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuDZEiaI_ppgLk3TvuT_DbHxUO2XHbUPOGE7B2EIijqE6lg4qIrUpXBC4O554ftuDf1LVyYmPfYcSP3Crsu9UAKD3l5Wno_R6X1XzQqpxWr_Yggqn7gIdZ9Ao0DB0yLFcRj2lqDsXkuA-XmuAgnzX1JorhKjZi21UJE8d9IDhVkBUlzEPcvxGeJEH2e5qVU9GJ4oA5UWf0Yx8BQctWOZGs6iHVUJFy03o3YuDuhw1WIoXP5oHEAH_vqJ",
  "about-team-elena.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCOYThJydDGLFkzWLJ1nXjBwN6YBdIaVHy6EaUkHwQUu80iz0Kq1Gk8Vk9TSD4fvrsdLzsXCs4T2JMF---PBeXBSClSOiFDeGKN3ZXH97QEFlYJ2SzmSqRklNuRhT17l2r7VMUzO7OXr0i4R4jCRcYaVn-XF25YD_FRQTtUeYKp75CqO6mzUUhLC3-N4-86sbn0zAJT7oBkGU4SqsYbXLn1gxwNcVZZL5axN_IHwQ2LwGe37nGnb818",
  "blog-featured.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuBVrXSzKlRdwz0F_x3sBczt297hjiH68PNySQViY9E5eo5JuJfgWjz2APX2XQIe7a-7IHEk4cf1uTjF_HWhszb9BPzHBSZTXj3npK9YLPUSdKxR0E5wiAYqHxgPM3zd5MS_3_-y22D3Ucxc8s4mraodKm5qiev-4Jb54qWGzkXqPYDjNqkNxNBR3BQIpXUbrc6PbJm9jEszb8kqC0r0kTJ2NkDz_qBL7q381P2RZtVtWjTRc-1Wu4g9",
  "blog-monorepo.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAQlpqFTB4l4yLBoeUTESlWIdZcmhCXtyEeyZGgTMgk-ip4rh0iyU_D7szYx7sRggjjDTTkQjvXqDLRmLOCYNq6bYo91FvyUEw-cf7vF4nrNFM0yLU-g-PcDsLRxPQ6JCUEmxADWiyC6TdX3rBhzSOl3Ra1-u_xP7iKsnxnKmjx2TLuKFhQWX2dWTeNFy_AnPQauFArTH5KjrIX28KafikfUv3XT0XqBuC76snI7e13V7vcVFsKoU2P",
  "blog-design-systems.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAOPSVS_ll5sCuXTb5Wr6EQkPaxDnYx4YC_a_jqxA7MkILXIGxwdJGiDKdzYXVI0yaksBhZHruSwXWkBic57wqqAi2ooIr3HiFdo2vurdC5MTQ4hjQxdibOG5s3HZZjxAtdFvZR5YkH4DIisCFsQFvHaRDvoraN4YhQY0mjURGGaf921J2BDMvb24WXh2ZLo1Vo6OcRkANv9SGIs3rP5LQe8FI1ciR5Z9qScWtrfCaLHEjxeL2zwL50",
  "blog-serverless.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuDCUO63mOaoxkYGS8YZDGra0SAhGOE9ReuGCFmdiCeOcnPqZhkZ2FfN3t5c_4YaG2jb1fVvQ4K-aX1jPazPQIFS-Rc8yBjd1hMGGjQyALqi2dH-ShyLWGpqkVUqM43x-8d73mCQXmWvRah7FA8bMJ3HbB6AGlr8kY9vXUSzz7g7CSQ9nnPP7-W71Ga5MJztrcH7L56C3vYKu5AzyvMsRp9fT1_sDXy6PtoxrMHrfXNL4x_K_jtM9Vrs",
  "blog-zero-trust.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuDArjX7zoUNbPFG8NrJAGz8UOyRP48nEvI9I8tna4aoLGfuJasdh8DGx_mxvmNoFQ-3Qbw4VmEksXF3BuirGmGGJBPA-3-enUmlQv8R-jxpe9pkGnTSS6-89hUehFLrAq6Nd6xb0BI1XLeZkCLRkLmgIlkOptMg5ZkLxAs6wxT8TRuFffOYEdcem2Ft0ny4lUoqrN0WHUehVNE0XObvWLzhkUtrFbr9qISetnYXjUXGojTit9SNzqF2",
  "blog-detail-author.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuB0qcD1vR6kieaS4P5a3Norw6baF-RAX-FjTNaqw70vJ55kY0h1g3OsU8722U7aYsOeSFjgAK_xsLXZ5DTEeJ8UI4iH27_-c-nLJSWZ3qG-_RG8ZhgaIIRNdE8YuGYaSNcCg9VIudEszDDh2QxeWEMxvsa24GnrUwQLMLlTXIIUOT0MrQ6PMNPeRNn4K-h195ebSitdzFh3EKIHi9njPap026x1szQRvX9en6YtaNrdlC6nmf7MPQt-",
  "blog-detail-hero.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuA1iRXfBpuxnm-_qSsAeIstDzcAiPY33HzOrYhmLKJDe0rQiQUxzt-3pZ77mzy3KATB6QxyXVXPU8mFWbx-7QWx1KjHhsmIe043sacH9JdfqGgUm_HdH1tGhqVnGFYrbaoCoGLN9EVEZMJPH0dxMsFBiaVGokAQWvBUvL25IhKH6Gj6WS5KVqQzksr1WRazTQ67Mj67_ntxxa0L6KWo_foKN_lIKitxfY3pVleHyBVs4GFkHPdJI963",
  "blog-related-1.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuD1j8mPao2GlPMbbwGHkFYg5NuP_eKxJ1c7S47OtP3IUR04qpuOkJVpFvFeF_VEHPpZzTfCcpbuIoU64Fr15cnJBZCkaYwlx7Y-o1MyJIU88gxVBwGAuLWB4FTuSsHd9PoPGvhaOwKn6Gwp6QeSJgpCJLBAIWw7qSnZWOgvgv19_TKj1RZvkjBACbagAC2Ey3oMCsu-Vdwp8GNNuqVJdfuBDX7ZyM7vtLQuLjURjNSIBacf8vA6BcL-",
  "blog-related-2.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuB7zb4CcNcR1B3okv2dJyl063K4rA5FkoiUhQAh_AxyYPgi9NgrWPWVly878F4-4pLWdMBg_3BRs8wH39Cg87edhvH0rpX3sp1FulYhHiHe0mrTV50cuE4I55UU39xn4nzi5_8aFP7G9H7JE1Nfetrpc6b-JyO55Jrt8HRQFfqEdogA1G8KtX6lifqr50AK3DWubxu8zCniet1_3e2i5tLdQd8sl27XBO-B4bMO0_zRlkscnUtafAG1",
  "blog-related-3.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuBJCdFrucg9caTgM_O6wLDcsKLERo6ACUTkS4oHQJQ6v2gXl46RBWerXx6diz8jXzyD2_w0b5pOaOP-wIq6V03ZEwW6W1LJWimCKrQX3htGYzu02k9zgARfbNEGol_aUFF1U1jrDmdB4bfXg6Xo5Pq1AM0ZX1jn6qlpiRYWBtsWsBtC5RjD_PLcpehbjpBKdVzGe5N-t06sL7ZS9LjgUOvOZfzt1POBShFZxUeV-21_vHgNWCmurBMv",
  "product-overview-website.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCkoSw7iHOTaMPxC2eH-1CbSO4p0BdFAkSNUPqE2v0nX-Fp9YwvHldwAytvtmc-lim2ZWZHE56EULwuQWCwQSx-2wblQ4APjh8y-q4we4yuO9n2Umt67gtU4qMD3lkC97fOOzfDVdmt0XRP9HjWA0lFjOveRKfBhURx2mSbrzagpbLSPYrJfc83CId0XCdIveHQQySw0w1hc2w_bWTQ5zZIjZ6O1mw1jh2nfVSQ5-fvPAg4q1xg3OPt",
  "product-overview-marketplace.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAenyY6dvjadDDSpU27tQqZUCwYrHdsnr2fYxzok1SXLsiuIr7o-ZNCBahnUzPjlK3E3cBnxD2w_dIpS1DIL0cc3ydUEe_P1Kg131vQEt71BJaMPGsvV8mRLlPlO2J7m9yexwTOEgFaMSlxs6RUjw9Th0GisGs6D5Uc57kw1sQkY5CXZoLllsbFhrpGdge3Yt_Gje5vRnUNb_akdEjFwNnHA9R99kiWx8bgMR3Zc39nOfKdU6ZAw5qX",
  "product-overview-custom.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuB35_WeacIZRmcpKbt8vFZ45MNO0Pr-sw9OK-EI4y_7zogTKW3gzX7qSaJ79P2K5COlMe6TOYga2sF4nq9FG2Hfur8o4zvVFuofael-FO3QXek9rbkACd5Rr1oRCuwpSMWB9g7dofM3HkSMpGzle5-DGEl1byTrzYl4E4xklo-7JUAZloEIp2eEzz3WRXOhQqSn_bxWQkL-I9zqbmL4pYLQAcQSKgYy8wACPJDx1zCYb0xqp6HswY6b",
  "product-website-hero.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCiG94AsOTCtJWP5pzQquwIY3QEHvjzyNdC3sGtC1GNeXTtlB21nybeY2w85L8hHrHDRt11fctUjS9Lwr8UNt47-7bpB5KDhCVQYu8M13V0mFfPDxazCkQNdgIjQ4EK_qSX8T73df4u5hA0_dLzCIOFNfuH3WGdiAH7AMn_rXrSZT80C_hEtKsnEGzDab6cXkixohg9lYhRtjUu1ACPhBPIZqW6FnkVn5mdmrGIIzb6criWbHHLdRjE",
  "product-website-news-1.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuChAy6924hf75bTQg7szuV-AeWvl4pvvR4TEMMD52JPfu5qAb4Lw6LVxDYw-Yn_IHSlE9hEl_OoHWrG4tjXQ_oynPECoECU5Th7TVsy1POPj12p8ma9T5Do1x9rlNp3qRjKVl94smzVTszt08jnSQfR0TSLRs-33OK_YjUX4DuXWvU31pn_lwie7GN2USe2yY03VpLu67Ybd8TIP0VPqdAe9aSTC0tL4CtClRGzGyvM6U6SBJgQ67dL",
  "product-website-news-2.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCtQ432xsFe-hSGqmKK5CfohFTiFgP2vaOuqhz-syHc7xFVvds36uZeksLPV3LjMMSQArvp-dm_e_J-CzsuaVQXjPK0oWCFzq7OI2gr9dN6FmKGAvE-g2PGMJalTNsSlgzV2FQJCVq3OGtOUoOTkIw5El2nv-tXyKzbbv-V26lOVq9VkdGrTR4NOMX36YvasUDJjf16Vm_VtWViPEle2N1hi9oHE1uG_HNb6iIhAKxbsD61kVRxwx4Q",
  "product-website-news-3.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAt46MkRnvhxFxKHxhrdfbeT6UleMip5ps8pKl7yJq9DtfXP1ywpKOVYbDzy2cs3YbrrXgRulcQjUsLAK6SlLVNEiedvl1UatTYgYNzKfi1LaRdgK4RV37mTgIpx-gx7NYESyN7k9gerU2WfUvoFupVTqEnw0rwoo_GoU_lz1KmYz-a9fhKTcp43N85z-pz9r0n7YEaw-X7GOoLXmSYBvW0S4d__-RDZdT_6wihuhCHTQvftRGFRERw",
  "product-custom-hero.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuC99oHH15WSwVlZDfh6Q36FLhlSRXLDZuMrs-m0-EFIWrQCVePgVn0pbs1MVk8Vv2seCoqK7c2QSWozBkOPoluGiJ6Yx8So1K6kIFcoEFV3LA24OO3V8JFo4-OUELqPn4mRPF7qc0Shn_UOV7pdrQukR7qln3zusnX_zDS0m6uYxiujCr9f9z-YodAQsnU_96oBM6emqLX-NbqV5XAYV3RkDcjOJRTXs9V05g6y9o1-B1h9lf2xTTa5",
  "product-erp-hero.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCEJKu5D6xdUr_tQIr8PEBLUGpzlOTIC3G8lpwBOUzcVteEsV_uyZNvFi8xt_VDwiy0Oy3WRkn8SoQrcsoM-iJ5b8k6qXvWYsJ9D2eMezJbd8mzVRTtATyhBZwFoorMk8u0A5SpLhbgHTeecv4SaS3n35lEUHE_T_JU5RYj-E7ycxASjntfGg-YlZCQ11qtvF5nTL11Nxu-4H82WxciugAhUKMsJamaq-rLQlf1IbqvNSMdPzv7l2Gg",
  "product-erp-security.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuDlzaQX39B8KdIOifRFVfctTCPKkyK7MzFHIf_vcsNoihUjFrxoQZDCfqNV-1ibLyyMwbjANNKiQPN3wzv6e_rZtzDPnI6fQCCmYoY3uu0sBbe0XzeYX6p_FGbrmBok14KzYf6t97hiiQuj557ks0WNqLlD5qIVkk6QbOk-qqpg2_L1_Yl_mQF6iWsM4Ypq537vqmZZ_7dNA7AbLksCkojvdwiJpymx9iDAEA1yaGL-CdOUn2kXtFP5",
  "product-erp-team.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAY_Xs_LNEJ_GWP84n53ot7Ptj4qIIhtP1o11Ca_kb8WKc1BgbwHok8aY3HEg4-FN-p3oLB8f6qnSucKJ0o0EhN6O9RK4qCsAnRyGoL6Dc8GAmq9wh3C7n2b0LzM-B3OXvIdl9Sb9JP7MBoi98e2avnwL0LSiH2xN2xmo3BxYfcdniG7OCKTVVRtlhdjUQaFoiT-92KFS-0yjWkaMtoKFi5ps7vjHmCy1Vm9FjoxTwt6h0yTb9fa-45",
  "product-ecommerce-hero.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAqNamkFyRVOKgDJhA6XzFQO7BCeqNRGHi1CW4NARmWaUwGHScrwwT2cye1jOrux0YW5t-7oBKz63CK67f8NgCDYviikWX5KjQRS0OQcY-i-CjWIqdl5BCXX1XoYLg_euHnqhWvh3PLsYRrnxlzIc_-B92_nA9XoWAn0DYQvqNOl7-3KaF_uWXbDG9_EMaILZiy1FCJsFaFE2MpyKWPDfEI3T9kK9I_AE5hEnF6tvr6gcrCd8O49u2W",
  "product-ecommerce-funnel.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuA4d9jmYKbVhWQ2N_UrBqiu0fiQ3kGY_vxUFVSGIXQfnIxJD04dwWZq_oXZWAO3x8MCWjt7r2dS2VwhK97UCuwwfyFmzq0xWlPeLsXyQeAnYX7pDpmsGKvy4aDFLx25OQAJxXQeTjvdmHkQryGrlnxNp4pQBtsrb2EnZPMEfaMuxaHV-IWXVfohujIWeaXRV9HVD4K3Pd4cVMzeetP7XaH61P8NTVmGOt2vaA4juYhRUrIKAhHxYC54",
  "product-ecommerce-api.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuBSqvdVHdEJIVIcNo5xLt0MGHCfiuSSm2kGGbxrsL0nCcWgxyvqSke4dB3O_NkInR9bHpzGZG_VukxNmkPjx-su7q37LBWfmDtBwruPLhTNsaMFI9rVB9s5JzaY-jvMpmOGtmmj5Px-r6p3fLfMsPBNPCSF_QWIxXSNy5fEO7pb6AKRUxOwBAACmYFjG91wphfUcod11IoqGV8vtvIVzP-UDoNIMSUEEiVF4_X-sSKKv93_Fs-hMIwE",
  "product-accounting-hero.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuA8eRXCyqo_uAjSlvzu2PmPxmObjwZCJWCXI8eDdwDFbTjkk0TiKnamxr3YAZfZrnjVVyqcnAyjJC4zHVGIVmdq11OtiG1QqEilzCAG2wnCHPwfQRBbUfvTGb46HmoO8eIWEaDCSPtkBIcS3PIuviss9TaIxuGPJQB-FWf6e6tfyUFYhdmdyFuk6SB0dkeGCfUe4M_2v-9jGbeC47aL0hiZusKAZr1439V-w3MuDMhhVwKkaK8LCifC",
  "product-accounting-invoice.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuCfUWUd6tsZ6IMOEn8pdvWAb9K0Z8a6nv6u6qsnqH6XMoZubF6Xcnm-hAeco9ErQCRMiEqzQ01tFz-mkYJ2NVCp9gKQPpj8ahFsK_QyypCbX_r3gHj7G1TgneMHstFTM5gwo2dBd8KjkFRL43tWTEe11J2OrHrc-Bsq5Mqcg6Mmh-As43En1nkeYfG3se58GKEQYPjLhJzIO8Qoj0V1-FqZrX3QeXammCUCR028l7B3miVerjz152hE",
  "product-listings-hero.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAenyY6dvjadDDSpU27tQqZUCwYrHdsnr2fYxzok1SXLsiuIr7o-ZNCBahnUzPjlK3E3cBnxD2w_dIpS1DIL0cc3ydUEe_P1Kg131vQEt71BJaMPGsvV8mRLlPlO2J7m9yexwTOEgFaMSlxs6RUjw9Th0GisGs6D5Uc57kw1sQkY5CXZoLllsbFhrpGdge3Yt_Gje5vRnUNb_akdEjFwNnHA9R99kiWx8bgMR3Zc39nOfKdU6ZAw5qX",
  "product-listings-avatar-1.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuA8BhF4HR15XF4_vh0tGMIbk_CzkjdvLK5sp_WlkiwmX6_BPlp11Hn5oSaS2PBHuhdWOnKndFM834WvFWOUjNLdqtsjoQGdRRDyQnd_6aPrnu1Md4nN8W7yrChJMO-UvwtQH4KG48zfxc1R4I6ZE71ZYe5ATESKNq5v_kMZ1woeynLzUA2555djhTR2Gg0NsZ61o31TAwPyKr6twOxAsyYiiZl1lRiUtYemcS4CcmuKEe9xtfb3e9E2",
  "product-listings-avatar-2.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuDkP6s4J4Q9hm84uLIpaOCa4TCq0U70695mcUgZ5jjfIU_s3vhk5nLOPGMAKG9QoVyi20RQFcP71_vWSvK_ISHhFXk9bfxccRRHuvqaWJgeI3lwKpxXxtGPEQCbxzKI9jA9YEsJL_LtSoIlfRcYJo2gAad1RSkvfwMndizVtbg5xavMszMc_bQ3hqxE8qOMy4qyXbASBh1En5J4jGaOQtHQ0dq68trXNlAvyGGWQY1P5AqW6x1ywZix",
  "product-listings-map.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuBQZC2nK-wnZBA5uXQudCPsuR1xkpysyZ8xdN7h2qsaBjMlP5uUKHhasUi9nVFBcALDfGftlh4YicCA0hIelUxjDwSGsfcvPI5KIL1TTmq96OlRuOkT1ka8ILTbKCqS1CjYryLbCh2NTvF_kqJ7tD1N6jrzhD-DLLKVfJpZCWs7a-j--wmhUi7rY0YFOi-FM-I505PiSXCpm9eplxwV8hZCfRJitEzKv_XFQQi2iwgdUN27xlwDip3T",
  "product-listings-house.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAPygK26O0tb4kDlPF3ioi5k0DJQvbAUskmwHUtf9ja3kGXRxYGdn_n0ymz5jKZrSjaCAbiGNa_zTVC6V2kowWBCbdYhO9VscC35HLHrkAQFv_AKF667RZcxezTAsPWnHi44PooECKMIQR0VmeIlsLOXxOwu9f1bNcdZMcGWJWo0nxKA6eFPmNzuG5cOJA4fOPdZdcWBgA7dtndYhTIMoSTVqNrwJ-AORATWDoQ7j-b-NiIQBxeZ7ZG",
  "product-listings-car.jpg": "https://lh3.googleusercontent.com/aida-public/AB6AXuAu_x0afxLSa0X7bnKT9YZ8PbLszSQ_VQsjrWZP0-xBfp6bwzcQDi4g6DFZyUcN5dFME5Chx7n6Iv424CYz3v-brfdx1Y46Hsn4q2x2CKu56grgfJ5FJ3Kvi_DhNTA9HuimlXe7U7fvptXK2q_sFdohKaRi828Rp6Qlkc2nkdcdKoQh6OoZaeVPNhStSaflWKxuIZ6y0H6PaF4stGqvYR0-MCCVFVVj6Ib05ArqEbkkJPv5Bon7mLDR",
  "product-agents-hero.jpg": "https://images.unsplash.com/photo-1525182008055-f88b95ff7980?auto=format&fit=crop&w=1600&q=80",
  "product-agents-calls.jpg": "https://images.unsplash.com/photo-1549923746-c502d488b3ea?auto=format&fit=crop&w=1600&q=80",
  "product-agents-whatsapp.jpg": "https://images.unsplash.com/photo-1611746872915-64382b5c76da?auto=format&fit=crop&w=1600&q=80",
  "product-agents-booking.jpg": "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1600&q=80",
  "product-agents-team.jpg": "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1600&q=80",
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`${url} -> ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    });
    req.on("error", reject);
  });
}

(async () => {
  const only = process.argv.slice(2);
  const entries = Object.entries(ImageMap).filter(([name]) => only.length === 0 || only.includes(name));
  let ok = 0;
  for (const [name, url] of entries) {
    const dest = path.join(outDir, name);
    try {
      await download(url, dest);
      ok++;
      console.log("OK", name);
    } catch (e) {
      console.error("FAIL", name, e.message);
    }
  }
  console.log(`Done ${ok}/${entries.length}`);
})();
