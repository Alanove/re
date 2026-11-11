using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using ShippingClientCSharp.ShippingReference;

namespace ShippingClientCSharp.CreateShipments
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        #region "Members"
        private List<Shipment> _Shipments = new List<Shipment>();
        private Shipment _Shipment = null;
        private List<Attachment> _Attachments = new List<Attachment>();
        #endregion
        private List<ShipmentItem> _Items = new List<ShipmentItem>();

        #region "Methods"
        private void ClearShipment()
        {
            //Shipper
            txtShipperReference1.Text = string.Empty;
            txtShipperReference2.Text = string.Empty;
            txtShipperAccountNumber.Text = string.Empty;

            txtShipperAddressLine1.Text = string.Empty;
            txtShipperAddressLine2.Text = string.Empty;
            txtShipperAddressLine3.Text = string.Empty;
            txtShipperAddressCity.Text = string.Empty;
            txtShipperAddressState.Text = string.Empty;
            txtShipperAddressPostCode.Text = string.Empty;
            txtShipperAddressCountry.Text = string.Empty;

            txtShipperContactDepartment.Text = string.Empty;
            txtShipperContactPersonName.Text = string.Empty;
            txtShipperContactTitle.Text = string.Empty;
            txtShipperContactCompanyName.Text = string.Empty;
            txtShipperContactPhoneNumber1.Text = string.Empty;
            txtShipperContactPhoneNumber1Ext.Text = string.Empty;
            txtShipperContactPhoneNumber2.Text = string.Empty;
            txtShipperContactPhoneNumber2Ext.Text = string.Empty;
            txtShipperContactFaxNumber.Text = string.Empty;
            txtShipperContactCellPhone.Text = string.Empty;
            txtShipperContactEmailAddress.Text = string.Empty;
            txtShipperContactType.Text = string.Empty;

            //Recipient
            txtRecipientReference1.Text = string.Empty;
            txtRecipientReference2.Text = string.Empty;
            txtRecipientAccountNumber.Text = string.Empty;

            txtRecipientAddressLine1.Text = string.Empty;
            txtRecipientAddressLine2.Text = string.Empty;
            txtRecipientAddressLine3.Text = string.Empty;
            txtRecipientAddressCity.Text = string.Empty;
            txtRecipientAddressState.Text = string.Empty;
            txtRecipientAddressPostCode.Text = string.Empty;
            txtRecipientAddressCountry.Text = string.Empty;

            txtRecipientContactDepartment.Text = string.Empty;
            txtRecipientContactPersonName.Text = string.Empty;
            txtRecipientContactTitle.Text = string.Empty;
            txtRecipientContactCompanyName.Text = string.Empty;
            txtRecipientContactPhoneNumber1.Text = string.Empty;
            txtRecipientContactPhoneNumber1Ext.Text = string.Empty;
            txtRecipientContactPhoneNumber2.Text = string.Empty;
            txtRecipientContactPhoneNumber2Ext.Text = string.Empty;
            txtRecipientContactFaxNumber.Text = string.Empty;
            txtRecipientContactCellPhone.Text = string.Empty;
            txtRecipientContactEmailAddress.Text = string.Empty;
            txtRecipientContactType.Text = string.Empty;

            //ThirdParty
            txtThirdPartyReference1.Text = string.Empty;
            txtThirdPartyReference2.Text = string.Empty;
            txtThirdPartyAccountNumber.Text = string.Empty;

            txtThirdPartyAddressLine1.Text = string.Empty;
            txtThirdPartyAddressLine2.Text = string.Empty;
            txtThirdPartyAddressLine3.Text = string.Empty;
            txtThirdPartyAddressCity.Text = string.Empty;
            txtThirdPartyAddressState.Text = string.Empty;
            txtThirdPartyAddressPostCode.Text = string.Empty;
            txtThirdPartyAddressCountry.Text = string.Empty;

            txtThirdPartyContactDepartment.Text = string.Empty;
            txtThirdPartyContactPersonName.Text = string.Empty;
            txtThirdPartyContactTitle.Text = string.Empty;
            txtThirdPartyContactCompanyName.Text = string.Empty;
            txtThirdPartyContactPhoneNumber1.Text = string.Empty;
            txtThirdPartyContactPhoneNumber1Ext.Text = string.Empty;
            txtThirdPartyContactPhoneNumber2.Text = string.Empty;
            txtThirdPartyContactPhoneNumber2Ext.Text = string.Empty;
            txtThirdPartyContactFaxNumber.Text = string.Empty;
            txtThirdPartyContactCellPhone.Text = string.Empty;
            txtThirdPartyContactEmailAddress.Text = string.Empty;
            txtThirdPartyContactType.Text = string.Empty;

            //Main information
            txtShipmentReference1.Text = string.Empty;
            txtShipmentReference2.Text = string.Empty;
            txtShipmentReference3.Text = string.Empty;
            txtForeignHAWB.Text = string.Empty;
            nudShipmentTransportType.Value = 0;

            dtpShipmentShippingDate.Value = DateTime.Now;
            dtpShipmentShippingDueDate.Value = DateTime.Now;

            txtShipmentAttachment.Text = string.Empty;
            lbShipmentAttachments.Items.Clear();

            txtShipmentPickupLocation.Text = string.Empty;
            txtShipmentPickupGUID.Text = string.Empty;
            txtShipmentComments.Text = string.Empty;
            txtShipmentAccountingInstructions.Text = string.Empty;
            txtShipmentOperationsInstructions.Text = string.Empty;

            //Details
            nudShipmentDetailsDimensionsLength.Value = 0;
            nudShipmentDetailsDimensionsWidth.Value = 0;
            nudShipmentDetailsDimensionsHeight.Value = 0;
            cmbShipmentDetailsDimensionsUnit.SelectedIndex = -1;

            nudShipmentDetailsActualWeightValue.Value = 0;
            cmbShipmentDetailsActualWeightUnit.SelectedIndex = -1;

            txtShipmentDetailsProductGroup.Text = string.Empty;
            txtShipmentDetailsProductType.Text = string.Empty;
            txtShipmentDetailsPaymentType.Text = string.Empty;
            txtShipmentDetailsPaymentOptions.Text = string.Empty;
            txtShipmentDetailsServices.Text = string.Empty;
            nudShipmentDetailsNumberOfPieces.Value = 0;
            txtShipmentDetailsDescriptionOfGoods.Text = string.Empty;
            txtShipmentDetailsGoodsOrigin.Text = string.Empty;

            nudShipmentDetailsCashOnDeliveryAmountValue.Value = 0;
            txtShipmentDetailsCashOnDeliveryAmountCurrency.Text = string.Empty;
            txtShipmentDetailsCashAdditionalDescription.Text = string.Empty;
            nudShipmentDetailsInsuranceValue.Value = 0;
            txtShipmentDetailsInsuranceCurrency.Text = string.Empty;
            nudShipmentDetailsCollectValue.Value = 0;
            txtShipmentDetailsCollectCurrency.Text = string.Empty;
            nudShipmentDetailsCashAdditionalValue.Value = 0;
            txtShipmentDetailsCashAdditionalCurrency.Text = string.Empty;
            nudShipmentDetailsCustomsValue.Value = 0;
            txtShipmentDetailsCustomsCurrency.Text = string.Empty;

            txtShipmentDetailsItemPackageType.Text = string.Empty;
            nudShipmentDetailsItemQuantity.Value = 0;
            nudShipmentDetailsItemWeightValue.Value = 0;
            cmbShipmentDetailsItemWeightUnit.SelectedIndex = -1;
            txtShipmentDetailsItemComments.Text = string.Empty;
            txtShipmentDetailsItemReference.Text = string.Empty;
            lvItems.Items.Clear();

            _Attachments = new List<Attachment>();
            _Items = new List<ShipmentItem>();
        }

        private void FillAttachments()
        {
            lbShipmentAttachments.Items.Clear();
            if ((_Attachments != null && _Attachments.Count > 0))
            {
                foreach (Attachment _Attachment in _Attachments)
                {
                    lbShipmentAttachments.Items.Add(_Attachment.FileName + "." + _Attachment.FileExtension);
                }
            }
        }

        private void FillItems()
        {
            lvItems.Items.Clear();
            if ((_Items != null && _Items.Count > 0))
            {
                foreach (ShipmentItem _Item in _Items)
                {
                    ListViewItem _lvItem = new ListViewItem();
                    _lvItem.Text = _Item.PackageType;
                    _lvItem.SubItems.Add(_Item.Quantity.ToString());
                    _lvItem.SubItems.Add(_Item.Weight.Value.ToString() + " " + _Item.Weight.Unit);
                    _lvItem.SubItems.Add(_Item.Comments);
                    _lvItem.SubItems.Add(_Item.Reference);

                    lvItems.Items.Add(_lvItem);
                }
            }
        }

        private void FillShipments()
        {
            lbShipments.Items.Clear();
            if ((_Shipments != null && _Shipments.Count > 0))
            {
                for (int _Index = 0; _Index <= _Shipments.Count - 1; _Index++)
                {
                    lbShipments.Items.Add("Shipment " + (_Index + 1).ToString());
                }
            }
        }

        private void btnAttachment_Click(System.Object sender, System.EventArgs e)
        {
            if ((ofgAttachment.ShowDialog(this) == System.Windows.Forms.DialogResult.OK))
            {
                txtShipmentAttachment.Text = ofgAttachment.FileName;
            }
        }

        private void btnAddAttachment_Click(System.Object sender, System.EventArgs e)
        {
            if ((!string.IsNullOrEmpty(txtShipmentAttachment.Text)))
            {
                System.IO.FileInfo _FileInfo = new System.IO.FileInfo(txtShipmentAttachment.Text);
                Attachment _Attachment = new Attachment();
                _Attachment.FileName = _FileInfo.Name;
                _Attachment.FileExtension = _FileInfo.Extension;
                _Attachment.FileContents = System.IO.File.ReadAllBytes(txtShipmentAttachment.Text);

                _Attachments.Add(_Attachment);
                FillAttachments();
            }
        }

        private void btnRemoveAttachment_Click(System.Object sender, System.EventArgs e)
        {
            if ((lbShipmentAttachments.Items.Count > 0))
            {
                if ((lbShipmentAttachments.SelectedIndex != -1))
                {
                    _Attachments.RemoveAt(lbShipmentAttachments.SelectedIndex);
                    FillAttachments();
                }
            }
        }

        private void btnAddItem_Click(System.Object sender, System.EventArgs e)
        {
            ShipmentItem _Item = new ShipmentItem();
            _Item.PackageType = txtShipmentDetailsItemPackageType.Text.Trim();
            _Item.Quantity = Convert.ToInt32(nudShipmentDetailsItemQuantity.Value);
            _Item.Weight = new Weight();
            _Item.Weight.Value = Convert.ToDouble(nudShipmentDetailsItemWeightValue.Value);
            _Item.Weight.Unit = cmbShipmentDetailsItemWeightUnit.Text;
            _Item.Comments = txtShipmentDetailsItemComments.Text.Trim();
            _Item.Reference = txtShipmentDetailsItemReference.Text.Trim();

            _Items.Add(_Item);
            FillItems();

            txtShipmentDetailsItemPackageType.Text = string.Empty;
            nudShipmentDetailsItemQuantity.Value = 0;
            nudShipmentDetailsItemWeightValue.Value = 0;
            cmbShipmentDetailsItemWeightUnit.SelectedIndex = -1;
            txtShipmentDetailsItemComments.Text = string.Empty;
            txtShipmentDetailsItemReference.Text = string.Empty;
        }

        private void btnRemoveItem_Click(System.Object sender, System.EventArgs e)
        {
            if ((_Items != null && _Items.Count > 0))
            {
                if ((lvItems.SelectedItems.Count > 0))
                {
                    _Items.RemoveAt(lvItems.SelectedItems[0].Index);
                    FillItems();
                }
            }
        }

        private void btnAddShipment_Click(System.Object sender, System.EventArgs e)
        {
            _Shipment = new Shipment();

            //Shipper
            _Shipment.Shipper = new Party();
            _Shipment.Shipper.Reference1 = txtShipperReference1.Text.Trim();
            _Shipment.Shipper.Reference2 = txtShipperReference2.Text.Trim();
            _Shipment.Shipper.AccountNumber = txtShipperAccountNumber.Text.Trim();

            _Shipment.Shipper.PartyAddress = new Address();
            _Shipment.Shipper.PartyAddress.Line1 = txtShipperAddressLine1.Text.Trim();
            _Shipment.Shipper.PartyAddress.Line2 = txtShipperAddressLine2.Text.Trim();
            _Shipment.Shipper.PartyAddress.Line3 = txtShipperAddressLine3.Text.Trim();
            _Shipment.Shipper.PartyAddress.City = txtShipperAddressCity.Text.Trim();
            _Shipment.Shipper.PartyAddress.StateOrProvinceCode = txtShipperAddressState.Text.Trim();
            _Shipment.Shipper.PartyAddress.PostCode = txtShipperAddressPostCode.Text.Trim();
            _Shipment.Shipper.PartyAddress.CountryCode = txtShipperAddressCountry.Text.Trim();

            _Shipment.Shipper.Contact = new Contact();
            _Shipment.Shipper.Contact.Department = txtShipperContactDepartment.Text.Trim();
            _Shipment.Shipper.Contact.PersonName = txtShipperContactPersonName.Text.Trim();
            _Shipment.Shipper.Contact.Title = txtShipperContactTitle.Text.Trim();
            _Shipment.Shipper.Contact.CompanyName = txtShipperContactCompanyName.Text.Trim();
            _Shipment.Shipper.Contact.PhoneNumber1 = txtShipperContactPhoneNumber1.Text.Trim();
            _Shipment.Shipper.Contact.PhoneNumber1Ext = txtShipperContactPhoneNumber1Ext.Text.Trim();
            _Shipment.Shipper.Contact.PhoneNumber2 = txtShipperContactPhoneNumber2.Text.Trim();
            _Shipment.Shipper.Contact.PhoneNumber2Ext = txtShipperContactPhoneNumber2Ext.Text.Trim();
            _Shipment.Shipper.Contact.FaxNumber = txtShipperContactFaxNumber.Text.Trim();
            _Shipment.Shipper.Contact.CellPhone = txtShipperContactCellPhone.Text.Trim();
            _Shipment.Shipper.Contact.EmailAddress = txtShipperContactEmailAddress.Text.Trim();
            _Shipment.Shipper.Contact.Type = txtShipperContactType.Text.Trim();

            //Recipient
            _Shipment.Consignee = new Party();
            _Shipment.Consignee.Reference1 = txtRecipientReference1.Text.Trim();
            _Shipment.Consignee.Reference2 = txtRecipientReference2.Text.Trim();
            _Shipment.Consignee.AccountNumber = txtRecipientAccountNumber.Text.Trim();

            _Shipment.Consignee.PartyAddress = new Address();
            _Shipment.Consignee.PartyAddress.Line1 = txtRecipientAddressLine1.Text.Trim();
            _Shipment.Consignee.PartyAddress.Line2 = txtRecipientAddressLine2.Text.Trim();
            _Shipment.Consignee.PartyAddress.Line3 = txtRecipientAddressLine3.Text.Trim();
            _Shipment.Consignee.PartyAddress.City = txtRecipientAddressCity.Text.Trim();
            _Shipment.Consignee.PartyAddress.StateOrProvinceCode = txtRecipientAddressState.Text.Trim();
            _Shipment.Consignee.PartyAddress.PostCode = txtRecipientAddressPostCode.Text.Trim();
            _Shipment.Consignee.PartyAddress.CountryCode = txtRecipientAddressCountry.Text.Trim();

            _Shipment.Consignee.Contact = new Contact();
            _Shipment.Consignee.Contact.Department = txtRecipientContactDepartment.Text.Trim();
            _Shipment.Consignee.Contact.PersonName = txtRecipientContactPersonName.Text.Trim();
            _Shipment.Consignee.Contact.Title = txtRecipientContactTitle.Text.Trim();
            _Shipment.Consignee.Contact.CompanyName = txtRecipientContactCompanyName.Text.Trim();
            _Shipment.Consignee.Contact.PhoneNumber1 = txtRecipientContactPhoneNumber1.Text.Trim();
            _Shipment.Consignee.Contact.PhoneNumber1Ext = txtRecipientContactPhoneNumber1Ext.Text.Trim();
            _Shipment.Consignee.Contact.PhoneNumber2 = txtRecipientContactPhoneNumber2.Text.Trim();
            _Shipment.Consignee.Contact.PhoneNumber2Ext = txtRecipientContactPhoneNumber2Ext.Text.Trim();
            _Shipment.Consignee.Contact.FaxNumber = txtRecipientContactFaxNumber.Text.Trim();
            _Shipment.Consignee.Contact.CellPhone = txtRecipientContactCellPhone.Text.Trim();
            _Shipment.Consignee.Contact.EmailAddress = txtRecipientContactEmailAddress.Text.Trim();
            _Shipment.Consignee.Contact.Type = txtRecipientContactType.Text.Trim();

            //ThirdParty
            _Shipment.ThirdParty = new Party();
            _Shipment.ThirdParty.Reference1 = txtThirdPartyReference1.Text.Trim();
            _Shipment.ThirdParty.Reference2 = txtThirdPartyReference2.Text.Trim();
            _Shipment.ThirdParty.AccountNumber = txtThirdPartyAccountNumber.Text.Trim();

            _Shipment.ThirdParty.PartyAddress = new Address();
            _Shipment.ThirdParty.PartyAddress.Line1 = txtThirdPartyAddressLine1.Text.Trim();
            _Shipment.ThirdParty.PartyAddress.Line2 = txtThirdPartyAddressLine2.Text.Trim();
            _Shipment.ThirdParty.PartyAddress.Line3 = txtThirdPartyAddressLine3.Text.Trim();
            _Shipment.ThirdParty.PartyAddress.City = txtThirdPartyAddressCity.Text.Trim();
            _Shipment.ThirdParty.PartyAddress.StateOrProvinceCode = txtThirdPartyAddressState.Text.Trim();
            _Shipment.ThirdParty.PartyAddress.PostCode = txtThirdPartyAddressPostCode.Text.Trim();
            _Shipment.ThirdParty.PartyAddress.CountryCode = txtThirdPartyAddressCountry.Text.Trim();

            _Shipment.ThirdParty.Contact = new Contact();
            _Shipment.ThirdParty.Contact.Department = txtThirdPartyContactDepartment.Text.Trim();
            _Shipment.ThirdParty.Contact.PersonName = txtThirdPartyContactPersonName.Text.Trim();
            _Shipment.ThirdParty.Contact.Title = txtThirdPartyContactTitle.Text.Trim();
            _Shipment.ThirdParty.Contact.CompanyName = txtThirdPartyContactCompanyName.Text.Trim();
            _Shipment.ThirdParty.Contact.PhoneNumber1 = txtThirdPartyContactPhoneNumber1.Text.Trim();
            _Shipment.ThirdParty.Contact.PhoneNumber1Ext = txtThirdPartyContactPhoneNumber1Ext.Text.Trim();
            _Shipment.ThirdParty.Contact.PhoneNumber2 = txtThirdPartyContactPhoneNumber2.Text.Trim();
            _Shipment.ThirdParty.Contact.PhoneNumber2Ext = txtThirdPartyContactPhoneNumber2Ext.Text.Trim();
            _Shipment.ThirdParty.Contact.FaxNumber = txtThirdPartyContactFaxNumber.Text.Trim();
            _Shipment.ThirdParty.Contact.CellPhone = txtThirdPartyContactCellPhone.Text.Trim();
            _Shipment.ThirdParty.Contact.EmailAddress = txtThirdPartyContactEmailAddress.Text.Trim();
            _Shipment.ThirdParty.Contact.Type = txtThirdPartyContactType.Text.Trim();

            //Main
            _Shipment.Reference1 = txtShipmentReference1.Text.Trim();
            _Shipment.Reference2 = txtShipmentReference2.Text.Trim();
            _Shipment.Reference3 = txtShipmentReference3.Text.Trim();
            _Shipment.ForeignHAWB = txtForeignHAWB.Text.Trim();
            _Shipment.TransportType = Convert.ToInt32(nudShipmentTransportType.Value);

            _Shipment.ShippingDateTime = dtpShipmentShippingDate.Value;
            _Shipment.DueDate = dtpShipmentShippingDueDate.Value;

            if ((_Attachments != null))
                _Shipment.Attachments = _Attachments.ToArray();

            _Shipment.PickupLocation = txtShipmentPickupLocation.Text.Trim();
            _Shipment.PickupGUID = txtShipmentPickupGUID.Text.Trim();
            _Shipment.Comments = txtShipmentComments.Text.Trim();
            _Shipment.AccountingInstrcutions = txtShipmentAccountingInstructions.Text.Trim();
            _Shipment.OperationsInstructions = txtShipmentOperationsInstructions.Text.Trim();

            //Details
            _Shipment.Details = new ShipmentDetails();
            _Shipment.Details.Dimensions = new Dimensions();
            _Shipment.Details.Dimensions.Length = Convert.ToDouble(nudShipmentDetailsDimensionsLength.Value);
            _Shipment.Details.Dimensions.Width = Convert.ToDouble(nudShipmentDetailsDimensionsWidth.Value);
            _Shipment.Details.Dimensions.Height = Convert.ToDouble(nudShipmentDetailsDimensionsHeight.Value);
            _Shipment.Details.Dimensions.Unit = cmbShipmentDetailsDimensionsUnit.Text;

            if ((nudShipmentDetailsActualWeightValue.Value > 0))
            {
                _Shipment.Details.ActualWeight = new Weight();
                _Shipment.Details.ActualWeight.Value = Convert.ToDouble(nudShipmentDetailsActualWeightValue.Value);
                _Shipment.Details.ActualWeight.Unit = cmbShipmentDetailsActualWeightUnit.Text;
            }

            _Shipment.Details.ProductGroup = txtShipmentDetailsProductGroup.Text.Trim();
            _Shipment.Details.ProductType = txtShipmentDetailsProductType.Text.Trim();
            _Shipment.Details.PaymentType = txtShipmentDetailsPaymentType.Text.Trim();
            _Shipment.Details.PaymentOptions = txtShipmentDetailsPaymentOptions.Text.Trim();
            _Shipment.Details.Services = txtShipmentDetailsServices.Text.Trim();
            _Shipment.Details.NumberOfPieces = Convert.ToInt32(nudShipmentDetailsNumberOfPieces.Value);
            _Shipment.Details.DescriptionOfGoods = txtShipmentDetailsDescriptionOfGoods.Text.Trim();
            _Shipment.Details.GoodsOriginCountry = txtShipmentDetailsGoodsOrigin.Text.Trim();

            if ((nudShipmentDetailsCashOnDeliveryAmountValue.Value > 0 && !string.IsNullOrEmpty(txtShipmentDetailsCashOnDeliveryAmountCurrency.Text)))
            {
                _Shipment.Details.CashOnDeliveryAmount = new Money();
                _Shipment.Details.CashOnDeliveryAmount.Value = Convert.ToDouble(nudShipmentDetailsCashOnDeliveryAmountValue.Value);
                _Shipment.Details.CashOnDeliveryAmount.CurrencyCode = txtShipmentDetailsCashOnDeliveryAmountCurrency.Text.Trim();
            }
            if ((nudShipmentDetailsInsuranceValue.Value > 0 && !string.IsNullOrEmpty(txtShipmentDetailsInsuranceCurrency.Text)))
            {
                _Shipment.Details.InsuranceAmount = new Money();
                _Shipment.Details.InsuranceAmount.Value = Convert.ToDouble(nudShipmentDetailsInsuranceValue.Value);
                _Shipment.Details.InsuranceAmount.CurrencyCode = txtShipmentDetailsInsuranceCurrency.Text.Trim();
            }
            if ((nudShipmentDetailsCollectValue.Value > 0 && !string.IsNullOrEmpty(txtShipmentDetailsCollectCurrency.Text)))
            {
                _Shipment.Details.CollectAmount = new Money();
                _Shipment.Details.CollectAmount.Value = Convert.ToDouble(nudShipmentDetailsCollectValue.Value);
                _Shipment.Details.CollectAmount.CurrencyCode = txtShipmentDetailsCollectCurrency.Text.Trim();
            }
            if ((nudShipmentDetailsCashAdditionalValue.Value > 0 && !string.IsNullOrEmpty(txtShipmentDetailsCashAdditionalCurrency.Text)))
            {
                _Shipment.Details.CashAdditionalAmount = new Money();
                _Shipment.Details.CashAdditionalAmount.Value = Convert.ToDouble(nudShipmentDetailsCashAdditionalValue.Value);
                _Shipment.Details.CashAdditionalAmount.CurrencyCode = txtShipmentDetailsCashAdditionalCurrency.Text.Trim();
            }
            _Shipment.Details.CashAdditionalAmountDescription = txtShipmentDetailsCashAdditionalDescription.Text.Trim();
            if ((nudShipmentDetailsCustomsValue.Value > 0 && !string.IsNullOrEmpty(txtShipmentDetailsCustomsCurrency.Text)))
            {
                _Shipment.Details.CustomsValueAmount = new Money();
                _Shipment.Details.CustomsValueAmount.Value = Convert.ToDouble(nudShipmentDetailsCustomsValue.Value);
                _Shipment.Details.CustomsValueAmount.CurrencyCode = txtShipmentDetailsCustomsCurrency.Text.Trim();
            }

            if ((_Items != null))
                _Shipment.Details.Items = _Items.ToArray();

            _Shipments.Add(_Shipment);
            FillShipments();
            ClearShipment();
        }

        private void btnRemoveShipment_Click(System.Object sender, System.EventArgs e)
        {
            if ((_Shipments != null && _Shipments.Count > 0))
            {
                if ((lbShipments.SelectedIndex != -1))
                {
                    _Shipments.RemoveAt(lbShipments.SelectedIndex);
                    FillShipments();
                }
            }
        }

        private void btnSubmitRequest_Click(System.Object sender, System.EventArgs e)
        {
            Cursor.Current = Cursors.WaitCursor;

            ShipmentCreationRequest _Request = new ShipmentCreationRequest();
            _Request.ClientInfo = new ClientInfo();
            _Request.ClientInfo.AccountCountryCode = txtAccountCountryCode.Text.Trim();
            _Request.ClientInfo.AccountEntity = txtAccountEntity.Text.Trim();
            _Request.ClientInfo.AccountNumber = txtAccountNumber.Text.Trim();
            _Request.ClientInfo.AccountPin = txtAccountPin.Text.Trim();
            _Request.ClientInfo.UserName = txtUsername.Text.Trim();
            _Request.ClientInfo.Password = txtPassword.Text.Trim();
            _Request.ClientInfo.Version = txtVersion.Text.Trim();

            _Request.Transaction = new Transaction();
            _Request.Transaction.Reference1 = txtReference1.Text.Trim();
            _Request.Transaction.Reference2 = txtReference2.Text.Trim();
            _Request.Transaction.Reference3 = txtReference3.Text.Trim();
            _Request.Transaction.Reference4 = txtReference4.Text.Trim();
            _Request.Transaction.Reference5 = txtReference5.Text.Trim();

            _Request.Shipments = _Shipments.ToArray();

            _Request.LabelInfo = null;
            if ((chkbGenerateLabels.Checked))
            {
                _Request.LabelInfo = new LabelInfo();
                _Request.LabelInfo.ReportID = Convert.ToInt32(nudReportID.Value);
                if ((rbReportAsURL.Checked))
                    _Request.LabelInfo.ReportType = "URL";
                if ((rbReportAsFile.Checked))
                    _Request.LabelInfo.ReportType = "RPT";
            }

            ShipmentCreationResponse _Response = null;
            Service_1_0Client _Client = new Service_1_0Client();

            try
            {
                _Client.Open();
                _Response = _Client.CreateShipments(_Request);
                _Client.Close();

                using (Form2 _frm = new Form2())
                {
                    _frm.Response = _Response;
                    _frm.ShowDialog(this);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message);
            }

            Cursor.Current = Cursors.Default;
        }

        private void btnReset_Click(System.Object sender, System.EventArgs e)
        {
            _Shipments = new List<Shipment>();
            _Shipment = new Shipment();
            _Attachments = new List<Attachment>();
            _Items = new List<ShipmentItem>();

            ClearShipment();
            lbShipments.Items.Clear();
        }

        private void lbShipments_DoubleClick(System.Object sender, System.EventArgs e)
        {
            Cursor.Current = Cursors.WaitCursor;

            _Shipment = _Shipments[lbShipments.SelectedIndex];
            _Shipments.RemoveAt(lbShipments.SelectedIndex);
            lbShipments.Items.RemoveAt(lbShipments.SelectedIndex);

            //Shipper
            txtShipperReference1.Text = _Shipment.Shipper.Reference1;
            txtShipperReference2.Text = _Shipment.Shipper.Reference2;
            txtShipperAccountNumber.Text = _Shipment.Shipper.AccountNumber;

            txtShipperAddressLine1.Text = _Shipment.Shipper.PartyAddress.Line1;
            txtShipperAddressLine2.Text = _Shipment.Shipper.PartyAddress.Line2;
            txtShipperAddressLine3.Text = _Shipment.Shipper.PartyAddress.Line3;
            txtShipperAddressCity.Text = _Shipment.Shipper.PartyAddress.City;
            txtShipperAddressState.Text = _Shipment.Shipper.PartyAddress.StateOrProvinceCode;
            txtShipperAddressPostCode.Text = _Shipment.Shipper.PartyAddress.PostCode;
            txtShipperAddressCountry.Text = _Shipment.Shipper.PartyAddress.CountryCode;

            txtShipperContactDepartment.Text = _Shipment.Shipper.Contact.Department;
            txtShipperContactPersonName.Text = _Shipment.Shipper.Contact.PersonName;
            txtShipperContactTitle.Text = _Shipment.Shipper.Contact.Title;
            txtShipperContactCompanyName.Text = _Shipment.Shipper.Contact.CompanyName;
            txtShipperContactPhoneNumber1.Text = _Shipment.Shipper.Contact.PhoneNumber1;
            txtShipperContactPhoneNumber1Ext.Text = _Shipment.Shipper.Contact.PhoneNumber1Ext;
            txtShipperContactPhoneNumber2.Text = _Shipment.Shipper.Contact.PhoneNumber2;
            txtShipperContactPhoneNumber2Ext.Text = _Shipment.Shipper.Contact.PhoneNumber2Ext;
            txtShipperContactFaxNumber.Text = _Shipment.Shipper.Contact.FaxNumber;
            txtShipperContactCellPhone.Text = _Shipment.Shipper.Contact.CellPhone;
            txtShipperContactEmailAddress.Text = _Shipment.Shipper.Contact.EmailAddress;
            txtShipperContactType.Text = _Shipment.Shipper.Contact.Type;

            //Recipient
            txtRecipientReference1.Text = _Shipment.Consignee.Reference1;
            txtRecipientReference2.Text = _Shipment.Consignee.Reference2;
            txtRecipientAccountNumber.Text = _Shipment.Consignee.AccountNumber;

            txtRecipientAddressLine1.Text = _Shipment.Consignee.PartyAddress.Line1;
            txtRecipientAddressLine2.Text = _Shipment.Consignee.PartyAddress.Line2;
            txtRecipientAddressLine3.Text = _Shipment.Consignee.PartyAddress.Line3;
            txtRecipientAddressCity.Text = _Shipment.Consignee.PartyAddress.City;
            txtRecipientAddressState.Text = _Shipment.Consignee.PartyAddress.StateOrProvinceCode;
            txtRecipientAddressPostCode.Text = _Shipment.Consignee.PartyAddress.PostCode;
            txtRecipientAddressCountry.Text = _Shipment.Consignee.PartyAddress.CountryCode;

            txtRecipientContactDepartment.Text = _Shipment.Consignee.Contact.Department;
            txtRecipientContactPersonName.Text = _Shipment.Consignee.Contact.PersonName;
            txtRecipientContactTitle.Text = _Shipment.Consignee.Contact.Title;
            txtRecipientContactCompanyName.Text = _Shipment.Consignee.Contact.CompanyName;
            txtRecipientContactPhoneNumber1.Text = _Shipment.Consignee.Contact.PhoneNumber1;
            txtRecipientContactPhoneNumber1Ext.Text = _Shipment.Consignee.Contact.PhoneNumber1Ext;
            txtRecipientContactPhoneNumber2.Text = _Shipment.Consignee.Contact.PhoneNumber2;
            txtRecipientContactPhoneNumber2Ext.Text = _Shipment.Consignee.Contact.PhoneNumber2Ext;
            txtRecipientContactFaxNumber.Text = _Shipment.Consignee.Contact.FaxNumber;
            txtRecipientContactCellPhone.Text = _Shipment.Consignee.Contact.CellPhone;
            txtRecipientContactEmailAddress.Text = _Shipment.Consignee.Contact.EmailAddress;
            txtRecipientContactType.Text = _Shipment.Consignee.Contact.Type;

            //ThirdParty
            txtThirdPartyReference1.Text = _Shipment.ThirdParty.Reference1;
            txtThirdPartyReference2.Text = _Shipment.ThirdParty.Reference2;
            txtThirdPartyAccountNumber.Text = _Shipment.ThirdParty.AccountNumber;

            txtThirdPartyAddressLine1.Text = _Shipment.ThirdParty.PartyAddress.Line1;
            txtThirdPartyAddressLine2.Text = _Shipment.ThirdParty.PartyAddress.Line2;
            txtThirdPartyAddressLine3.Text = _Shipment.ThirdParty.PartyAddress.Line3;
            txtThirdPartyAddressCity.Text = _Shipment.ThirdParty.PartyAddress.City;
            txtThirdPartyAddressState.Text = _Shipment.ThirdParty.PartyAddress.StateOrProvinceCode;
            txtThirdPartyAddressPostCode.Text = _Shipment.ThirdParty.PartyAddress.PostCode;
            txtThirdPartyAddressCountry.Text = _Shipment.ThirdParty.PartyAddress.CountryCode;

            txtThirdPartyContactDepartment.Text = _Shipment.ThirdParty.Contact.Department;
            txtThirdPartyContactPersonName.Text = _Shipment.ThirdParty.Contact.PersonName;
            txtThirdPartyContactTitle.Text = _Shipment.ThirdParty.Contact.Title;
            txtThirdPartyContactCompanyName.Text = _Shipment.ThirdParty.Contact.CompanyName;
            txtThirdPartyContactPhoneNumber1.Text = _Shipment.ThirdParty.Contact.PhoneNumber1;
            txtThirdPartyContactPhoneNumber1Ext.Text = _Shipment.ThirdParty.Contact.PhoneNumber1Ext;
            txtThirdPartyContactPhoneNumber2.Text = _Shipment.ThirdParty.Contact.PhoneNumber2;
            txtThirdPartyContactPhoneNumber2Ext.Text = _Shipment.ThirdParty.Contact.PhoneNumber2Ext;
            txtThirdPartyContactFaxNumber.Text = _Shipment.ThirdParty.Contact.FaxNumber;
            txtThirdPartyContactCellPhone.Text = _Shipment.ThirdParty.Contact.CellPhone;
            txtThirdPartyContactEmailAddress.Text = _Shipment.ThirdParty.Contact.EmailAddress;
            txtThirdPartyContactType.Text = _Shipment.ThirdParty.Contact.Type;

            //Main
            txtShipmentReference1.Text = _Shipment.Reference1;
            txtShipmentReference2.Text = _Shipment.Reference2;
            txtShipmentReference3.Text = _Shipment.Reference3;
            txtForeignHAWB.Text = _Shipment.ForeignHAWB;
            nudShipmentTransportType.Value = _Shipment.TransportType;

            dtpShipmentShippingDate.Value = _Shipment.ShippingDateTime;
            dtpShipmentShippingDueDate.Value = _Shipment.DueDate;

            if ((_Attachments != null))
            {
                _Attachments = _Shipment.Attachments.ToList();
                FillAttachments();
            }

            txtShipmentPickupLocation.Text = _Shipment.PickupLocation;
            txtShipmentPickupGUID.Text = _Shipment.PickupGUID;
            txtShipmentComments.Text = _Shipment.Comments;
            txtShipmentAccountingInstructions.Text = _Shipment.AccountingInstrcutions;
            txtShipmentOperationsInstructions.Text = _Shipment.OperationsInstructions;

            //Details
            nudShipmentDetailsDimensionsLength.Value = Convert.ToDecimal(_Shipment.Details.Dimensions.Length);
            nudShipmentDetailsDimensionsWidth.Value = Convert.ToDecimal(_Shipment.Details.Dimensions.Width);
            nudShipmentDetailsDimensionsHeight.Value = Convert.ToDecimal(_Shipment.Details.Dimensions.Height);
            cmbShipmentDetailsDimensionsUnit.Text = _Shipment.Details.Dimensions.Unit;

            if ((_Shipment.Details.ActualWeight != null))
            {
                nudShipmentDetailsActualWeightValue.Value = Convert.ToDecimal(_Shipment.Details.ActualWeight.Value);
                cmbShipmentDetailsActualWeightUnit.Text = _Shipment.Details.ActualWeight.Unit;
            }

            txtShipmentDetailsProductGroup.Text = _Shipment.Details.ProductGroup;
            txtShipmentDetailsProductType.Text = _Shipment.Details.ProductType;
            txtShipmentDetailsPaymentType.Text = _Shipment.Details.PaymentType;
            txtShipmentDetailsPaymentOptions.Text = _Shipment.Details.PaymentOptions;
            txtShipmentDetailsServices.Text = _Shipment.Details.Services;
            nudShipmentDetailsNumberOfPieces.Value = _Shipment.Details.NumberOfPieces;
            txtShipmentDetailsDescriptionOfGoods.Text = _Shipment.Details.DescriptionOfGoods;
            txtShipmentDetailsGoodsOrigin.Text = _Shipment.Details.GoodsOriginCountry;

            if ((_Shipment.Details.CashOnDeliveryAmount != null))
            {
                nudShipmentDetailsCashOnDeliveryAmountValue.Value = Convert.ToDecimal(_Shipment.Details.CashOnDeliveryAmount.Value);
                txtShipmentDetailsCashOnDeliveryAmountCurrency.Text = _Shipment.Details.CashOnDeliveryAmount.CurrencyCode;
            }
            if ((_Shipment.Details.InsuranceAmount != null))
            {
                nudShipmentDetailsInsuranceValue.Value = Convert.ToDecimal(_Shipment.Details.InsuranceAmount.Value);
                txtShipmentDetailsInsuranceCurrency.Text = _Shipment.Details.InsuranceAmount.CurrencyCode;
            }
            if ((_Shipment.Details.CollectAmount != null))
            {
                nudShipmentDetailsCollectValue.Value = Convert.ToDecimal(_Shipment.Details.CollectAmount.Value);
                txtShipmentDetailsCollectCurrency.Text = _Shipment.Details.CollectAmount.CurrencyCode;
            }
            if ((_Shipment.Details.CashAdditionalAmount != null))
            {
                nudShipmentDetailsCashAdditionalValue.Value = Convert.ToDecimal(_Shipment.Details.CashAdditionalAmount.Value);
                txtShipmentDetailsCashAdditionalCurrency.Text = _Shipment.Details.CashAdditionalAmount.CurrencyCode;
            }
            txtShipmentDetailsCashAdditionalDescription.Text = _Shipment.Details.CashAdditionalAmountDescription;
            if ((_Shipment.Details.CustomsValueAmount != null))
            {
                nudShipmentDetailsCustomsValue.Value = Convert.ToDecimal(_Shipment.Details.CustomsValueAmount.Value);
                txtShipmentDetailsCustomsCurrency.Text = _Shipment.Details.CustomsValueAmount.CurrencyCode;
            }

            if ((_Shipment.Details.Items != null))
            {
                _Items = _Shipment.Details.Items.ToList();
                FillItems();
            }

            Cursor.Current = Cursors.Default;
        }

        private void Form1_Load(System.Object sender, System.EventArgs e)
        {
            rbReportAsURL.Checked = true;
            chkbGenerateLabels.Checked = false;
            chkbGenerateLabels_CheckedChanged(null, null);
        }

        private void chkbGenerateLabels_CheckedChanged(System.Object sender, System.EventArgs e)
        {
            nudReportID.Enabled = chkbGenerateLabels.Checked;
            rbReportAsFile.Enabled = chkbGenerateLabels.Checked;
            rbReportAsURL.Enabled = chkbGenerateLabels.Checked;
        }
        #endregion

    }
}
